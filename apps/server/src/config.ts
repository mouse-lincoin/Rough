export interface ServerConfig {
  port: number;
  collabPort: number;
  webOrigin: string;
  databaseUrl: string;
  jwtSecret: string;
  devAuth: boolean;
  githubClientId: string;
  githubClientSecret: string;
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Bucket: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    collabPort: Number(process.env.COLLAB_PORT ?? 3001),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://rough:rough@localhost:5432/rough',
    jwtSecret: process.env.JWT_SECRET ?? 'rough-dev-secret-change-me',
    devAuth: process.env.DEV_AUTH === 'true' || process.env.NODE_ENV !== 'production',
    githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    s3AccessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    s3SecretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    s3Bucket: process.env.S3_BUCKET ?? 'rough',
  };
}
