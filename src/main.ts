import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@src/app.module';
import CustomLogger from '@src/common/logger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Enable CORS for WebSocket support
  app.enableCors({
    origin: '*', // In production, set this to your frontend URL(s)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  const logger = app.get(CustomLogger);
  logger.setContext('Bootstrap');

  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.logWithContext('success', `Application is running on port ${port}`);
}
bootstrap();
