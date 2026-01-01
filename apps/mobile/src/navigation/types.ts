export type RootStackParamList = {
  Tabs: undefined;
  ConnectBox: { onDone?: () => void | Promise<void> };
  CreateBox: {
    deviceId: string;
    currentQuantity: number;
    unit: 'g' | 'ml';
    onCreated?: () => void | Promise<void>;
  };
  SetFullLevel: {
    boxId: string;
    boxName: string;
    unit: 'g' | 'ml';
    mode: 'recalibrate' | 'set';
    currentFullQuantity?: number;
    onDone?: () => void;
  };
  BoxDetails: { boxId: string };
};

export type TabsParamList = {
  Boxes: undefined;
  Settings: undefined;
};
