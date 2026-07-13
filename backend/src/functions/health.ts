import { app, type HttpResponseInit } from '@azure/functions';

export async function health(): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: { status: 'ok', time: new Date().toISOString() },
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: health,
});
