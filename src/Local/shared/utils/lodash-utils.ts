/**
 * Simple lodash utilities replacement for Local mode
 * Avoiding external dependencies
 */

export const cloneDeep = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => cloneDeep(item)) as T;
  if (typeof obj === "object") {
    const clonedObj = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = cloneDeep((obj as Record<string, unknown>)[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
};