import { Server } from '@hocuspocus/server';

const port = Number(process.env.COLLAB_PORT ?? 3099);

Server.configure({
  port,
  async onAuthenticate() {
    return { user: { id: 'e2e', name: 'E2E' } };
  },
})
  .listen()
  .then(() => {
    console.info(`E2E collab server listening on :${port}`);
  });
