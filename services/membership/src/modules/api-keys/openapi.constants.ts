/**
 * Constants shared between the OpenAPI setup and the controller decorators.
 *
 * They live apart from openapi.ts on purpose: that file imports the module in
 * order to restrict the document to it, and the controller inside that module
 * needs the scheme name. Keeping the two constants here breaks what would
 * otherwise be an import cycle evaluated while decorators run.
 */

/** Name the API key security scheme is registered under. */
export const API_KEY_SECURITY_SCHEME = 'ApiKeyAuth';

/** Where the interactive docs are served, relative to the server root. */
export const OPENAPI_DOCS_PATH = 'api/docs';
