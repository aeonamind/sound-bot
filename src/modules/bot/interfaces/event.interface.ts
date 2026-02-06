import { ClientEvents } from 'discord.js';

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  /** The event name */
  name: K;
  /** Whether to only trigger once */
  once?: boolean;
  /** Execute the event handler */
  execute: (...args: ClientEvents[K]) => Promise<unknown> | unknown;
}
