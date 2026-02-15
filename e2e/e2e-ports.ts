export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 3101);
export const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5175);

export const E2E_API_BASE_URL = `http://127.0.0.1:${E2E_API_PORT}`;
export const E2E_WEB_BASE_URL = `http://127.0.0.1:${E2E_WEB_PORT}`;

