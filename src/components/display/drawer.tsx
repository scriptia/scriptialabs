import * as React from 'react';

import { DialogSurface, type DialogSurfaceProps } from './dialog-surface';

export type DrawerProps = DialogSurfaceProps;

export function Drawer(props: DrawerProps) {
  return <DialogSurface {...props} />;
}
