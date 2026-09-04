export function createMockEmailService(): Record<string, jest.Mock> {
  return {
    sendInvoiceCreated: jest.fn().mockResolvedValue(undefined),
    sendPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
    sendMandateSetupRequired: jest.fn().mockResolvedValue(undefined),
    sendMandateConfirmed: jest.fn().mockResolvedValue(undefined),
    sendWelcome: jest.fn().mockResolvedValue(undefined),
    sendDBSExpiryWarning: jest.fn().mockResolvedValue(undefined),
    sendConsentExpiryWarning: jest.fn().mockResolvedValue(undefined),
    sendSessionReminder: jest.fn().mockResolvedValue(undefined),
    sendSessionCancelled: jest.fn().mockResolvedValue(undefined),
    sendBroadcast: jest.fn().mockResolvedValue(undefined),
    sendWaitlistConfirmation: jest.fn().mockResolvedValue(undefined),
    sendWaitlistDrip1: jest.fn().mockResolvedValue(undefined),
    sendWaitlistDrip2: jest.fn().mockResolvedValue(undefined),
    sendWaitlistDrip3: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockConfigService(
  overrides?: Record<string, any>,
): Record<string, jest.Mock> {
  const values: Record<string, any> = {
    CLUB_NAME: 'Test Swimming Club',
    APP_URL: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret',
    DATABASE_URL: 'postgresql://localhost/test',
    ...overrides,
  };

  return {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      if (key in values) {
        return values[key];
      }
      return defaultValue;
    }),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key in values) {
        return values[key];
      }
      throw new Error(`Configuration key "${key}" does not exist`);
    }),
  };
}

export function createMockGoCardlessService(): Record<string, jest.Mock> {
  return {
    isConfigured: jest.fn().mockReturnValue(true),
    createRedirectFlow: jest.fn().mockResolvedValue({
      id: 'RE000000000000',
      redirect_url: 'https://pay.gocardless.com/flow/static/auth',
    }),
    completeRedirectFlow: jest.fn().mockResolvedValue({
      links: { mandate: 'MD000000000000', customer: 'CU000000000000' },
    }),
    getCustomer: jest.fn().mockResolvedValue({ id: 'CU000000000000' }),
    getMandate: jest.fn().mockResolvedValue({ id: 'MD000000000000', status: 'active' }),
    cancelMandate: jest.fn().mockResolvedValue({ id: 'MD000000000000', status: 'cancelled' }),
    createPayment: jest
      .fn()
      .mockResolvedValue({ id: 'PM000000000000', status: 'pending_submission' }),
    getPayment: jest.fn().mockResolvedValue({ id: 'PM000000000000', status: 'confirmed' }),
    listPayments: jest.fn().mockResolvedValue({ payments: [], meta: {} }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    parseWebhookEvent: jest.fn().mockReturnValue([]),
  };
}
