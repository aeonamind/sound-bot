import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { commonConfig } from './core/configs/common.config';
import { botConfig } from './core/configs/bot.config';
import { BotModule } from './modules/bot/bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [commonConfig, botConfig],
      cache: true,
      expandVariables: true,
    }),
    BotModule,
  ],
})
export class AppModule {}
