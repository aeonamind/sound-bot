import { Controller, Get, Render } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigName } from '@core/constants/config-name.constant';
import { BotConfig } from '@core/configs/bot.config';

@Controller()
export class BotController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Render('index')
  getHomePage() {
    const botConfig = this.configService.get<BotConfig>(ConfigName.Bot);
    return {
      clientId: botConfig.clientId,
    };
  }
}
