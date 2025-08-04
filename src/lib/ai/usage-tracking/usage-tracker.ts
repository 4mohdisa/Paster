import type {
  Tokens,
  UsageTrackingAdapter,
} from './types';


export class DefaultUsageTracker implements UsageTrackingAdapter {
  name = "none";

  trackUsage(customerId: string, modelName: string, tokens: Tokens): Promise<boolean> {
    // No-op implementation
    return Promise.resolve(true);
  }

}

const defaultUsageTracker = new DefaultUsageTracker();

export default defaultUsageTracker;