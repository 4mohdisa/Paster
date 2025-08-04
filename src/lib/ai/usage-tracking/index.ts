import type {
  Tokens,
  UsageTrackingAdapter,
} from './types';
import usageTracker from './usage-tracker';

let activeAdapter: UsageTrackingAdapter;

if (usageTracker.name === 'metronome') {
  activeAdapter = usageTracker;
} else if (usageTracker.name === 'polar') {
  activeAdapter = usageTracker;
} else {
  activeAdapter = {
    trackUsage: () => Promise.resolve(false),
  } as UsageTrackingAdapter;
}

export async function trackUsage({
  customerId,
  modelName,
  tokens,
}: {
  customerId: string;
  modelName: string;
  tokens: Tokens;
}): Promise<boolean> {
  return activeAdapter.trackUsage(customerId, modelName, tokens);
}

export default activeAdapter;


