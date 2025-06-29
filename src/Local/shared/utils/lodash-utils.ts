/**
 * Simple lodash utilities replacement for Local mode
 * Avoiding external dependencies
 */

export const cloneDeep = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => cloneDeep(item)) as any;
  if (typeof obj === "object") {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = cloneDeep((obj as any)[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};