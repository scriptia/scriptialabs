import * as React from 'react';

import { DialogSurface, type DialogSurfaceProps } from './dialog-surface';

export type ModalProps = DialogSurfaceProps;

export function Modal(props: ModalProps) {
  return <DialogSurface {...props} />;
}
