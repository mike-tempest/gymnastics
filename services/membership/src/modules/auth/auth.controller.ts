import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterClubDto } from './dto/register-club.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('register-club')
  registerClub(@Body() registerClubDto: RegisterClubDto) {
    return this.authService.registerClub(registerClubDto);
  }

  @Public()
  @Post('login')
  login(
    @Body() loginDto: LoginDto,
    @Request() req: { ip?: string; headers?: Record<string, string | undefined> },
  ) {
    // Behind Railway's load balancer the socket address is always internal, so
    // prefer the forwarded client IP when present.
    const forwarded = req?.headers?.['x-forwarded-for'];
    const ipAddress =
      typeof forwarded === 'string' && forwarded.length > 0
        ? forwarded.split(',')[0].trim()
        : req?.ip;

    return this.authService.login(loginDto, {
      ipAddress,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: { user: Record<string, unknown> }) {
    return req.user;
  }
}
