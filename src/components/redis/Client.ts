import { Redis } from '@upstash/redis';

export default new Redis({
  url: process.env.REDIS_ENDPOINT,
  token: process.env.REDIS_KEY
});