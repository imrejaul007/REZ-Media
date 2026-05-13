import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { CallModel } from '../models/Call';
import { TranscriptModel } from '../models/Transcript';
import {
  CallStatus,
  CallContext,
  TwilioCallStatus,
  TwilioVoiceWebhook,
  ConversationState
} from '../types';
import { ConversationEngine } from './conversationEngine';
import { DncService } from './dncService';

export class VoiceService {
  private client: twilio.Twilio;
  private conversationEngine: ConversationEngine;
  private dncService: DncService;

  constructor() {
    this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.conversationEngine = new ConversationEngine();
    this.dncService = new DncService();
  }

  /**
   * Initiate an outbound voice call
   */
  async initiateCall(
    to: string,
    context: CallContext,
    options: {
      campaignId?: string;
      trigger?: string;
      customerId?: string;
      cartId?: string;
      orderId?: string;
      priority?: string;
      maxAttempts?: number;
      scheduledAt?: Date;
    } = {}
  ): Promise<{ callSid: string; localCallId: string }> {
    // Check DNC list
    const isDnc = await this.dncService.isPhoneDnc(to);
    if (isDnc) {
      throw new Error(`Phone number ${to} is on the Do Not Call list`);
    }

    // Generate unique identifiers
    const localCallId = uuidv4();
    const callSid = `CA${uuidv4().replace(/-/g, '').substring(0, 32)}`;

    // Create call record in database
    const callRecord = await CallModel.create({
      callSid,
      to,
      from: config.twilioPhoneNumber,
      status: CallStatus.INITIATED,
      campaignId: options.campaignId,
      trigger: options.trigger,
      customerId: options.customerId,
      cartId: options.cartId,
      orderId: options.orderId,
      priority: options.priority || 'medium',
      context,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      scheduledAt: options.scheduledAt || new Date(),
      conversationState: ConversationState.GREETING,
      conversationHistory: []
    });

    try {
      // Make the actual Twilio call
      const call = await this.client.calls.create({
        to,
        from: config.twilioPhoneNumber,
        url: `${config.voiceWebhookUrl}/twiml/start/${localCallId}`,
        statusCallback: `${config.voiceWebhookUrl}/api/voice/webhook/status`,
        statusCallbackEvent: [
          'initiated',
          'ringing',
          'answered',
          'completed'
        ],
        statusCallbackMethod: 'POST',
        timeout: 30
      });

      // Update call record with Twilio SID
      callRecord.twilioCallSid = call.sid;
      callRecord.status = CallStatus.RINGING;
      callRecord.attempts = 1;
      await callRecord.save();

      return {
        callSid: call.sid,
        localCallId: localCallId
      };
    } catch (error) {
      // Update call record with failure
      callRecord.status = CallStatus.FAILED;
      callRecord.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await callRecord.save();
      throw error;
    }
  }

  /**
   * Handle TwiML generation for call start
   */
  async generateStartTwiML(callId: string): Promise<string> {
    const callRecord = await CallModel.findOne({ callSid: callId });
    if (!callRecord) {
      throw new Error(`Call not found: ${callId}`);
    }

    // Get the appropriate template based on trigger
    const template = this.conversationEngine.getTemplate(callRecord.trigger || 'cart_abandoned');

    // Build the greeting with context variables
    const greeting = this.interpolateTemplate(template.greeting, callRecord.context);
    const message = this.interpolateTemplate(template.message, callRecord.context);

    // Update call status
    callRecord.status = CallStatus.SPEAKING;
    callRecord.startedAt = new Date();
    await callRecord.save();

    // Generate TwiML
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN" bargeIn="true">
    ${greeting} ${message}
  </Say>
  <Record
    action="/twiml/recording/${callId}"
    method="POST"
    timeout="5"
    maxLength="30"
    playBeep="true"
    recordingStatusCallback="${config.voiceWebhookUrl}/api/voice/webhook/recording"
  />
</Response>`;
  }

  /**
   * Handle voice recording and transcription
   */
  async handleRecording(
    callId: string,
    recordingUrl: string,
    recordingSid: string
  ): Promise<void> {
    const callRecord = await CallModel.findOne({ callSid: callId });
    if (!callRecord) {
      throw new Error(`Call not found: ${callId}`);
    }

    // Update call record with recording info
    callRecord.recordingUrl = recordingUrl;
    await callRecord.save();

    // Create transcript record
    await TranscriptModel.create({
      callId: callRecord._id,
      callSid: callId,
      recordingSid
    });

    // Get next response from conversation engine
    await this.processUserResponse(callId, '');
  }

  /**
   * Process user response and generate AI reply
   */
  async processUserResponse(callId: string, userSpeech: string): Promise<string> {
    const callRecord = await CallModel.findOne({ callSid: callId });
    if (!callRecord) {
      throw new Error(`Call not found: ${callId}`);
    }

    callRecord.status = CallStatus.LISTENING;

    // Determine user intent
    const { intent, transcript } = await this.conversationEngine.detectIntent(userSpeech);

    // Add to conversation history
    callRecord.conversationHistory.push({
      timestamp: new Date(),
      speaker: 'user',
      transcript: transcript || userSpeech,
      intent,
      confidence: 0.9
    });

    // Get AI response based on intent
    const { response, nextState } = await this.conversationEngine.getResponse(
      callRecord.conversationState,
      intent,
      callRecord.context
    );

    // Update conversation state
    callRecord.conversationState = nextState;

    // Add AI response to history
    callRecord.conversationHistory.push({
      timestamp: new Date(),
      speaker: 'ai',
      transcript: response
    });

    await callRecord.save();

    return response;
  }

  /**
   * Generate TwiML response for user input
   */
  generateUserInputTwiML(callId: string, response: string, isFinal: boolean = false): string {
    const action = isFinal ? '/twiml/goodbye' : '/twiml/continue';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN" bargeIn="true">
    ${response}
  </Say>
  ${isFinal ? '' : `
  <Record
    action="${action}/${callId}"
    method="POST"
    timeout="5"
    maxLength="30"
    playBeep="true"
  />`}
</Response>`;
  }

  /**
   * Generate goodbye TwiML
   */
  generateGoodbyeTwiML(callId: string, message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    ${message}
  </Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Generate transfer to agent TwiML
   */
  generateTransferTwiML(callId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    I will connect you with a customer service representative. Please hold the line.
  </Say>
  <Dial
    action="/twiml/transfer-complete/${callId}"
    method="POST"
    record="record-from-answer"
    recordingStatusCallback="${config.voiceWebhookUrl}/api/voice/webhook/recording"
  >
    <Number
      statusCallbackEvent="initiated ringing answered completed"
      statusCallback="${config.voiceWebhookUrl}/api/voice/webhook/transfer-status"
    >
      ${process.env.HUMAN_AGENT_NUMBER || '+15551234567'}
    </Number>
  </Dial>
</Response>`;
  }

  /**
   * Handle call status update from Twilio webhook
   */
  async handleStatusUpdate(status: TwilioCallStatus): Promise<void> {
    const callRecord = await CallModel.findOne({ twilioCallSid: status.callSid });
    if (!callRecord) {
      console.error(`Call not found for SID: ${status.callSid}`);
      return;
    }

    // Map Twilio status to our status
    const statusMap: Record<string, CallStatus> = {
      'queued': CallStatus.INITIATED,
      'ringing': CallStatus.RINGING,
      'in-progress': CallStatus.ANSWERED,
      'completed': CallStatus.CONCLUDED,
      'busy': CallStatus.BUSY,
      'failed': CallStatus.FAILED,
      'no-answer': CallStatus.NO_ANSWER,
      'canceled': CallStatus.CANCELLED
    };

    const newStatus = statusMap[status.callStatus];
    if (newStatus) {
      callRecord.status = newStatus;

      if (newStatus === CallStatus.ANSWERED && !callRecord.answeredAt) {
        callRecord.answeredAt = new Date();
      }

      if (newStatus === CallStatus.CONCLUDED || newStatus === CallStatus.FAILED) {
        callRecord.concludedAt = new Date();
        if (callRecord.startedAt) {
          callRecord.duration = Math.floor(
            (callRecord.concludedAt.getTime() - callRecord.startedAt.getTime()) / 1000
          );
        }
      }

      await callRecord.save();
    }
  }

  /**
   * Handle Twilio voice webhook
   */
  async handleVoiceWebhook(webhook: TwilioVoiceWebhook): Promise<string> {
    const callRecord = await CallModel.findOne({ twilioCallSid: webhook.CallSid });

    if (!callRecord) {
      console.error(`Call not found for SID: ${webhook.CallSid}`);
      return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
    }

    // Handle different call stages
    if (webhook.CallStatus === 'in-progress' && callRecord.status === CallStatus.RINGING) {
      callRecord.status = CallStatus.ANSWERED;
      callRecord.answeredAt = new Date();
      await callRecord.save();
    }

    // Generate appropriate TwiML based on call stage
    if (webhook.CallStatus === 'in-progress' && !callRecord.startedAt) {
      return await this.generateStartTwiML(webhook.CallSid);
    }

    // If call is completed, check for hangup reason
    if (webhook.CallStatus === 'completed') {
      return await this.generateEndTwiML(callRecord);
    }

    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  /**
   * Generate end call TwiML
   */
  private async generateEndTwiML(callRecord: any): Promise<string> {
    const template = this.conversationEngine.getTemplate(callRecord.trigger || 'cart_abandoned');
    const goodbye = this.interpolateTemplate(template.goodbye, callRecord.context);

    callRecord.status = CallStatus.CONCLUDED;
    callRecord.concludedAt = new Date();
    await callRecord.save();

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    ${goodbye}
  </Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Interpolate template variables with context
   */
  private interpolateTemplate(template: string, context: CallContext): string {
    let result = template;
    const placeholders: Record<string, string | number | undefined> = {
      customerName: context.customerName || 'there',
      storeName: context.storeName || 'our store',
      itemCount: context.itemCount || 0,
      totalAmount: context.totalAmount || '0',
      orderId: context.orderId || '',
      appointmentTime: context.appointmentTime || '',
      trackingNumber: context.trackingNumber || '',
      estimatedDelivery: context.estimatedDelivery || ''
    };

    for (const [key, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return result;
  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<any> {
    return CallModel.findById(callId)
      .populate('campaignId')
      .populate('transcriptId');
  }

  /**
   * Get call by Twilio SID
   */
  async getCallBySid(twilioCallSid: string): Promise<any> {
    return CallModel.findOne({ twilioCallSid })
      .populate('campaignId')
      .populate('transcriptId');
  }

  /**
   * Cancel a call
   */
  async cancelCall(callId: string): Promise<boolean> {
    const callRecord = await CallModel.findById(callId);
    if (!callRecord) {
      throw new Error(`Call not found: ${callId}`);
    }

    if (callRecord.twilioCallSid) {
      try {
        await this.client.calls(callRecord.twilioCallSid).update({
          status: 'canceled'
        });
      } catch (error) {
        console.error('Failed to cancel Twilio call:', error);
      }
    }

    callRecord.status = CallStatus.CANCELLED;
    callRecord.concludedAt = new Date();
    await callRecord.save();

    return true;
  }

  /**
   * Get call statistics
   */
  async getCallStats(dateRange?: { start: Date; end: Date }): Promise<any> {
    const matchStage: any = {};
    if (dateRange) {
      matchStage.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    return CallModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          initiated: { $sum: { $cond: [{ $eq: ['$status', CallStatus.INITIATED] }, 1, 0] } },
          answered: { $sum: { $cond: [{ $eq: ['$status', CallStatus.ANSWERED] }, 1, 0] } },
          concluded: { $sum: { $cond: [{ $eq: ['$status', CallStatus.CONCLUDED] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', CallStatus.FAILED] }, 1, 0] } },
          busy: { $sum: { $cond: [{ $eq: ['$status', CallStatus.BUSY] }, 1, 0] } },
          noAnswer: { $sum: { $cond: [{ $eq: ['$status', CallStatus.NO_ANSWER] }, 1, 0] } },
          transferred: { $sum: { $cond: ['$transferredToAgent', 1, 0] } },
          avgDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);
  }
}

export const voiceService = new VoiceService();
