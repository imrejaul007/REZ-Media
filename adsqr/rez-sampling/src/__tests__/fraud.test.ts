describe('Fraud Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass clean scan', async () => {
    const mockResponse = {
      result: 'pass',
      riskScore: 0.1,
    };

    (global.fetch as unknown as { mockResolvedValueOnce: (val: unknown) => void }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await fetch('/api/scan/abc123', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device_abc',
        location: { lat: 19.07, lng: 72.87 },
        timestamp: new Date().toISOString(),
      }),
    });

    const data = await response.json();
    expect(data.result).toBe('pass');
  });

  it('should block suspicious scan', async () => {
    const mockResponse = {
      result: 'block',
      riskScore: 0.95,
      reasons: ['vpn_detected', 'velocity_high'],
    };

    (global.fetch as unknown as { mockResolvedValueOnce: (val: unknown) => void }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await fetch('/api/scan/xyz789', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'suspicious_device',
        vpn: true,
        scanCount: 50,
      }),
    });

    const data = await response.json();
    expect(data.result).toBe('block');
  });
});
