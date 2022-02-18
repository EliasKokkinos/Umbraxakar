export { }
declare global {
  interface Array<T> {
    first(): T;
    remove(elem: T): Array<T>;
    uniqueBy(key: keyof T): Array<T>;
    orderBy(keyToSort: keyof T, direction: 'ascending' | 'descending' | 'none'): Array<T>;
  }
}

if (!Array.prototype.first) {
  Array.prototype.first = function <T>(): T {
    return this[0];
  }
}

if (!Array.prototype.remove) {
  Array.prototype.remove = function <T>(elem: T): T[] {
    return this.filter(e => e !== elem);
  }
}

if (!Array.prototype.uniqueBy) {
  Array.prototype.uniqueBy = function <T>(key: keyof T): T[] {
    return [...new Map(this.map(v => [v[key], v])).values()] as T[];
  }
}


if (!Array.prototype.orderBy) {
  Array.prototype.orderBy = function <T>(
    keyToSort: keyof T,
    direction: 'ascending' | 'descending' | 'none',
  ): T[] {
    if (direction === 'none') {
      return this
    }
    const compare = (objectA: T, objectB: T) => {
      const valueA = objectA[keyToSort]
      const valueB = objectB[keyToSort]

      if (valueA === valueB) {
        return 0
      }

      if (valueA > valueB) {
        return direction === 'ascending' ? 1 : -1
      } else {
        return direction === 'ascending' ? -1 : 1
      }
    }

    return this.slice().sort(compare)
  }
}

