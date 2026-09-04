import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UnsubscribeController } from './unsubscribe.controller';
import { EmailService } from './email.service';

describe('UnsubscribeController', () => {
  let controller: UnsubscribeController;

  const mockEmailService = {
    verifyUnsubscribeToken: jest.fn(),
    suppress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnsubscribeController],
      providers: [{ provide: EmailService, useValue: mockEmailService }],
    }).compile();

    controller = module.get<UnsubscribeController>(UnsubscribeController);
    jest.clearAllMocks();
  });

  it('suppresses the address when the token is valid', async () => {
    mockEmailService.verifyUnsubscribeToken.mockReturnValue(true);

    const result = await controller.unsubscribe({
      email: 'parent@example.com',
      token: 'valid-token',
    });

    expect(result).toEqual({ unsubscribed: true });
    expect(mockEmailService.suppress).toHaveBeenCalledWith('parent@example.com');
  });

  it('rejects an invalid token without suppressing', async () => {
    mockEmailService.verifyUnsubscribeToken.mockReturnValue(false);

    await expect(
      controller.unsubscribe({ email: 'parent@example.com', token: 'forged' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockEmailService.suppress).not.toHaveBeenCalled();
  });
});
