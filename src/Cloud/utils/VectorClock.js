/**
 * VectorClock - 分散システム用ベクタークロック実装
 * 操作の並行性と因果関係を追跡するためのデータ構造
 */
export class VectorClock {
  constructor(clock = {}) {
    this.clock = { ...clock };
  }

  /**
   * 指定ユーザーのクロックを1つ進める
   * @param {string} userId - ユーザーID
   * @returns {VectorClock} - this（チェイン可能）
   */
  increment(userId) {
    this.clock[`user_${userId}`] = (this.clock[`user_${userId}`] || 0) + 1;
    return this;
  }

  /**
   * 他のベクタークロックと統合（各要素の最大値を取る）
   * @param {Object} otherClock - 他のクロック
   * @returns {VectorClock} - this（チェイン可能）
   */
  update(otherClock) {
    for (const [userId, timestamp] of Object.entries(otherClock)) {
      this.clock[userId] = Math.max(this.clock[userId] || 0, timestamp);
    }
    return this;
  }

  /**
   * 他のベクタークロックと比較
   * @param {Object} otherClock - 比較対象のクロック
   * @returns {string} - 'before' | 'after' | 'concurrent' | 'equal'
   */
  compare(otherClock) {
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
   * @returns {VectorClock} - 新しいインスタンス
   */
  clone() {
    return new VectorClock(this.clock);
  }

  /**
   * JSON形式でクロックデータを取得
   * @returns {Object} - クロックデータ
   */
  toJSON() {
    return { ...this.clock };
  }

  /**
   * 文字列表現
   * @returns {string} - クロックの文字列表現
   */
  toString() {
    return JSON.stringify(this.clock);
  }

  /**
   * 2つのベクタークロックをマージ（静的メソッド）
   * @param {Object} clock1 - 第1のクロック
   * @param {Object} clock2 - 第2のクロック
   * @returns {Object} - マージされたクロック
   */
  static merge(clock1, clock2) {
    const merged = new VectorClock(clock1);
    merged.update(clock2);
    return merged.toJSON();
  }

  /**
   * 因果関係の検証
   * @param {Object} otherClock - 比較対象のクロック
   * @returns {boolean} - このクロックが他のクロックの原因となりうるか
   */
  happensBefore(otherClock) {
    return this.compare(otherClock) === 'before';
  }

  /**
   * 並行性の検証
   * @param {Object} otherClock - 比較対象のクロック
   * @returns {boolean} - 2つのクロックが並行か
   */
  isConcurrent(otherClock) {
    return this.compare(otherClock) === 'concurrent';
  }
}