import pino, { type Logger } from 'pino';

export type CreateLoggerOptions = {
  secrets: readonly string[];
  destination?: pino.DestinationStream;
};

export function createLogger({
  secrets,
  destination,
}: CreateLoggerOptions): Logger {
  const paths = secrets.flatMap((key) => [key, `*.${key}`]);

  return pino(
    {
      redact: {
        paths,
        censor: '[redacted]',
      },
    },
    destination,
  );
}
