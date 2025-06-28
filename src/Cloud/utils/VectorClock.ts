// ===== Type Definitions =====

/** Vector clock comparison result */
export type VectorClockComparison = 'before' | 'after' | 'concurrent' | 'equal';

/** Vector clock data structure - maps user IDs to timestamps */
export interface VectorClockData {
  [userId: string]: number;
}

/** User ID in the format 'user_<id>' */
export type UserId = string;

/** Timestamp value */
export type Timestamp = number;

// ===== Main Class =====

/**
 * VectorClock - 分散システム用ベクタークロック実装
 * 操作の並行性と因果関係を追跡するためのデータ構造
 */
export class VectorClock {
  private clock: VectorClockData;

  constructor(clock: VectorClockData = {}) {
    this.clock = { ...clock };
  }

  /**
   * 指定ユーザーのクロックを1つ進める
   * @param userId - ユーザーID
   * @returns this（チェイン可能）
   */
  increment(userId: string): VectorClock {
    this.clock[`user_${userId}`] = (this.clock[`user_${userId}`] || 0) + 1;
    return this;
  }

  /**
   * 他のベクタークロックと統合（各要素の最大値を取る）
   * @param otherClock - 他のクロック
   * @returns this（チェイン可能）
   */
  update(otherClock: VectorClockData): VectorClock {
    for (const [userId, timestamp] of Object.entries(otherClock)) {
      this.clock[userId] = Math.max(this.clock[userId] || 0, timestamp);
    }
    return this;
  }

  /**
   * 他のベクタークロックと比較
   * @param otherClock - 比較対象のクロック
   * @returns 'before' | 'after' | 'concurrent' | 'equal'
   */
  compare(otherClock: VectorClockData): VectorClockComparison {
    const thisKeys = new Set(Object.keys(this.clock));
    const otherKeys = new Set(Object.keys(otherClock));
    const allKeys = new Set([...thisKeys, ...otherKeys]);

    let isLess = false;
    let isGreater = false;

    for (const key of allKeys) {
      const thisVal = this.clock[key] || 0;
      const otherVal = otherClock[key] || 0;

      if (thisVal < otherVal) isLess = true;
      if (thisVal > otherVal) isGreater = true;
    }

    if (isLess && isGreater) return 'concurrent';
    if (isLess) return 'before';
    if (isGreater) return 'after';
    return 'equal';
  }

  /**
   * クロックのコピーを作成
   * @returns 新しいインスタンス
   */
  clone(): VectorClock {
    return new VectorClock(this.clock);
  }

  /**
   * JSON形式でクロックデータを取得
   * @returns クロックデータ
   */
  toJSON(): VectorClockData {
    return { ...this.clock };
  }

  /**
   * 文字列表現
   * @returns クロックの文字列表現
   */
  toString(): string {
    return JSON.stringify(this.clock);
  }

  /**
   * 2つのベクタークロックをマージ（静的メソッド）
   * @param clock1 - 第1のクロック
   * @param clock2 - 第2のクロック
   * @returns マージされたクロック
   */
  static merge(clock1: VectorClockData, clock2: VectorClockData): VectorClockData {
    const merged = new VectorClock(clock1);
    merged.update(clock2);
    return merged.toJSON();
  }

  /**
   * 因果関係の検証
   * @param otherClock - 比較対象のクロック
   * @returns このクロックが他のクロックの原因となりうるか
   */
  happensBefore(otherClock: VectorClockData): boolean {
    return this.compare(otherClock) === 'before';
  }

  /**
   * 並行性の検証
   * @param otherClock - 比較対象のクロック
   * @returns 2つのクロックが並行か
   */
  isConcurrent(otherClock: VectorClockData): boolean {
    return this.compare(otherClock) === 'concurrent';
  }
}