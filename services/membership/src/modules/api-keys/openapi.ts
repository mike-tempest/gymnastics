import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_KEY_HEADER } from './guards/api-key.guard';
import { ApiKeysModule } from './api-keys.module';
import { API_KEY_SECURITY_SCHEME, OPENAPI_DOCS_PATH } from './openapi.constants';

/**
 * Publishes the club read API documentation (TEM-32).
 *
 * Scope is deliberately narrow. The document covers the read endpoints a club
 * would actually consume, and nothing else: the internal controllers the web
 * app talks to are excluded, because publishing them would present an
 * unversioned internal surface as though it were a contract we intend to
 * keep. The management controller carries @ApiExcludeController for the same
 * reason.
 *
 * The document is generated at boot from the decorators on the read
 * controller, so it cannot drift from the routes it describes.
 */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Club read API')
    .setDescription(
      [
        'A read-only view of your club data, authenticated with a club-scoped API key.',
        '',
        `Send your key in the \`${API_KEY_HEADER}\` header. A key is created by a club`,
        'admin under Settings, is shown exactly once, and can be revoked at any time;',
        'revocation takes effect on the very next request.',
        '',
        'Keys grant read access only. Any write verb is refused, whatever the key holds.',
        'Every key is scoped to one club and can never read another club data.',
        '',
        'Requests are rate limited per key. Exceeding the limit returns 429 with',
        'standard RateLimit headers describing when to retry.',
        '',
        'Medical notes, emergency contacts and payment-provider identifiers are not',
        'exposed here. A club can still retrieve those through its full export.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: API_KEY_HEADER,
        in: 'header',
        description: 'Your club read API key, in the form gymk_<id>.<secret>.',
      },
      API_KEY_SECURITY_SCHEME,
    )
    .build();

  // `include` is what keeps the document to the read API. Without it Swagger
  // walks every controller in the app and publishes the internal surface too.
  // ApiKeysModule also holds the admin management controller, which carries
  // @ApiExcludeController so it drops back out again.
  const document = SwaggerModule.createDocument(app, config, {
    include: [ApiKeysModule],
  });

  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Club read API',
  });
}
