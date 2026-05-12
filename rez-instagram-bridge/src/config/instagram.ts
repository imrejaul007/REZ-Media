import axios, { AxiosInstance, AxiosError } from 'axios';
import winston from 'winston';
import { config } from './index';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface InstagramUser {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  website: string;
  igId: string;
}

export interface InstagramMedia {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string;
  timestamp: string;
  username: string;
  children?: { id: string; mediaType: string; mediaUrl: string }[];
}

export interface InstagramConversation {
  id: string;
  threadId: string;
  participants: { id: string; username: string }[];
  updatedAt: string;
  unreadCount: number;
}

export interface InstagramMessage {
  id: string;
  text: string;
  createdAt: string;
  from: { id: string; username: string };
  to: { id: string };
  attachments?: { type: string; url: string }[];
}

class InstagramConfig {
  private client: AxiosInstance;
  private accessToken: string;

  constructor() {
    this.accessToken = config.instagram.accessToken;
    this.client = axios.create({
      baseURL: `${config.meta.baseUrl}/${config.meta.apiVersion}`,
      timeout: config.meta.timeout,
      params: {
        access_token: this.accessToken,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Instagram API Error', {
          status: error.response?.status,
          message: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });

        if (error.response?.status === 401) {
          logger.error('Instagram access token expired');
        }

        return Promise.reject(error);
      }
    );
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Instagram configuration');

    try {
      // Verify access token
      const appTokenInfo = await this.debugToken();
      logger.info('Instagram token verified', {
        scopes: appTokenInfo.scopes,
        expiresAt: appTokenInfo.expiresAt,
      });

      // Get business account info
      const accountInfo = await this.getBusinessAccount();
      logger.info('Instagram business account connected', {
        accountId: accountInfo.igId,
        username: accountInfo.username,
        followersCount: accountInfo.followersCount,
      });
    } catch (error) {
      logger.error('Failed to initialize Instagram configuration', { error });
      throw error;
    }
  }

  async debugToken(): Promise<{ scopes: string[]; expiresAt: number }> {
    const response = await this.client.get('/debug_token', {
      params: { input_token: this.accessToken },
    });

    return {
      scopes: response.data.data.scopes || [],
      expiresAt: response.data.data.data_access_expires_at || 0,
    };
  }

  async getBusinessAccount(): Promise<InstagramUser> {
    const accountId = config.instagram.businessAccountId;

    const response = await this.client.get(`/${accountId}`, {
      params: {
        fields: 'id,username,name,profile_picture_url,biography,followers_count,followers_count,following_count,media_count,website,ig_id',
      },
    });

    const data = response.data;
    return {
      id: data.id,
      username: data.username,
      name: data.name || data.username,
      profilePictureUrl: data.profile_picture_url || '',
      biography: data.biography || '',
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
      mediaCount: data.media_count || 0,
      website: data.website || '',
      igId: data.ig_id,
    };
  }

  async getUserProfile(userId: string): Promise<InstagramUser> {
    const response = await this.client.get(`/${userId}`, {
      params: {
        fields: 'id,username,name,profile_picture_url,biography,followers_count,following_count,media_count,website,ig_id',
      },
    });

    const data = response.data;
    return {
      id: data.id,
      username: data.username,
      name: data.name || data.username,
      profilePictureUrl: data.profile_picture_url || '',
      biography: data.biography || '',
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
      mediaCount: data.media_count || 0,
      website: data.website || '',
      igId: data.ig_id,
    };
  }

  async sendDirectMessage(recipientId: string, message: string): Promise<{ messageId: string }> {
    const accountId = config.instagram.businessAccountId;

    const response = await this.client.post(`/${accountId}/messages`, {
      recipient: { id: recipientId },
      message: { text: message },
    });

    return {
      messageId: response.data.message_id,
    };
  }

  async sendRepliedMessage(threadId: string, messageId: string, message: string): Promise<{ messageId: string }> {
    const accountId = config.instagram.businessAccountId;

    const response = await this.client.post(`/${accountId}/messages`, {
      recipient: { thread_id: threadId },
      message: { text: message },
    });

    return {
      messageId: response.data.message_id,
    };
  }

  async getConversations(): Promise<InstagramConversation[]> {
    const accountId = config.instagram.businessAccountId;

    const response = await this.client.get(`/${accountId}/conversations`, {
      params: {
        fields: 'id,updated_at,can_reply,is_group,participants,unread_count',
      },
    });

    return response.data.data.map((conv: any) => ({
      id: conv.id,
      threadId: conv.id,
      participants: conv.participants?.data?.map((p: any) => ({
        id: p.id,
        username: p.username,
      })) || [],
      updatedAt: conv.updated_at,
      unreadCount: conv.unread_count || 0,
    }));
  }

  async getMessages(threadId: string): Promise<InstagramMessage[]> {
    const response = await this.client.get(`/${threadId}/messages`, {
      params: {
        fields: 'id,created_at,from,to,text,attachments',
      },
    });

    return response.data.data.map((msg: any) => ({
      id: msg.id,
      text: msg.text || '',
      createdAt: msg.created_at,
      from: msg.from,
      to: msg.to,
      attachments: msg.attachments?.data || [],
    }));
  }

  async getMediaComments(mediaId: string, maxResults = 50): Promise<any[]> {
    const response = await this.client.get(`/${mediaId}/comments`, {
      params: {
        fields: 'id,text,created_at,from,replies,like_count',
        limit: maxResults,
      },
    });

    return response.data.data;
  }

  async replyToComment(commentId: string, message: string): Promise<{ id: string }> {
    const response = await this.client.post(`/${commentId}/replies`, {
      params: {
        access_token: this.accessToken,
      },
      data: {
        message,
      },
    });

    return { id: response.data.id };
  }

  async hideComment(commentId: string): Promise<void> {
    await this.client.post(`/${commentId}/replies`, {
      params: {
        access_token: this.accessToken,
      },
      data: {
        hide: true,
      },
    });
  }

  async getMentions(maxResults = 50): Promise<any[]> {
    const accountId = config.instagram.businessAccountId;

    const response = await this.client.get(`/${accountId}/tags`, {
      params: {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,username',
        limit: maxResults,
      },
    });

    return response.data.data;
  }

  async getMedia(mediaId: string): Promise<InstagramMedia> {
    const response = await this.client.get(`/${mediaId}`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{media_type,media_url}',
      },
    });

    const data = response.data;
    return {
      id: data.id,
      caption: data.caption || '',
      mediaType: data.media_type,
      mediaUrl: data.media_url || '',
      thumbnailUrl: data.thumbnail_url || '',
      permalink: data.permalink,
      timestamp: data.timestamp,
      username: data.username,
      children: data.children?.data?.map((c: any) => ({
        id: c.id,
        mediaType: c.media_type,
        mediaUrl: c.media_url,
      })),
    };
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const instagramConfig = new InstagramConfig();
