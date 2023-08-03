import { ConfigName } from '../constants/config-name.constant';

export const commonConfig = () => ({
  [ConfigName.Common]: {},
});

export type CommonConfig = ReturnType<typeof commonConfig>[ConfigName.Common];
