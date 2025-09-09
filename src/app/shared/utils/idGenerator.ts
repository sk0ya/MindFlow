export type IdType = 'node' | 'map' | 'link' | 'notification' | 'upload' | 'file';

const ID_PREFIXES: Record<IdType, string> = {
  node: 'node',
  map: 'map',
  link: 'link',
  notification: 'notif',
  upload: 'upload',
  file: 'file'
};

export function generateId(type: IdType = 'node'): string {
  const prefix = ID_PREFIXES[type];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

export const generateNodeId = () => generateId('node');
export const generateMapId = () => generateId('map');
export const generateLinkId = () => generateId('link');
export const generateNotificationId = () => generateId('notification');
export const generateUploadId = () => generateId('upload');
export const generateFileId = () => generateId('file');