export interface TrackingStep {
  step: string;
  completed: boolean;
}

export interface OrderTrackingDetails {
  orderNumber: string;
  status: string;
  recipient: {
    name: string;
    city: string;
  };
  deliveryDate: string;
  progress: TrackingStep[];
}
