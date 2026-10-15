export const handler = async () => ({ statusCode: 503, body: JSON.stringify({ code: 'NOT_DEPLOYED', message: 'Image service is not deployed.' }) })
