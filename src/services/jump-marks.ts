export interface Mark {
  label: string;
  pane: 0 | 1 | 2;
  blockHeight?: number;
  txHash?: string;
  pinned: boolean;
  createdAt: number;
}

interface Persistence {
  list: () => Promise<Array<{ label: string; pane: number; block_height?: number; tx_hash?: string; pinned: boolean; created_at: number }>>;
  put: (mark: { label: string; pane: number; block_height?: number; tx_hash?: string; pinned?: boolean }) => Promise<void>;
  del: (label: string) => Promise<void>;
  setPinned: (label: string, pinned: boolean) => Promise<void>;
}

export class JumpMarks {
  private marks: Mark[] = [];
  private currentIndex: number = -1;
  private persistence: Persistence | null = null;
  private autoLabelCounter: number = 1;

  attachPersistence(p: Persistence) {
    this.persistence = p;
  }

  async loadFromPersistence() {
    if (!this.persistence) return;

    const rows = await this.persistence.list();
    this.marks = rows.map(r => ({
      label: r.label,
      pane: r.pane as 0 | 1 | 2,
      blockHeight: r.block_height,
      txHash: r.tx_hash,
      pinned: r.pinned,
      createdAt: r.created_at
    }));

    // Set autoLabelCounter to highest numeric label + 1
    const numericLabels = this.marks
      .map(m => parseInt(m.label, 10))
      .filter(n => !isNaN(n));

    if (numericLabels.length > 0) {
      this.autoLabelCounter = Math.max(...numericLabels) + 1;
    }
  }

  list(): Mark[] {
    return [...this.marks];
  }

  nextAutoLabel(): string {
    const label = String(this.autoLabelCounter);
    this.autoLabelCounter++;
    return label;
  }

  async addOrReplace(label: string, pane: 0 | 1 | 2, blockHeight?: number, txHash?: string) {
    const existing = this.marks.find(m => m.label === label);

    if (existing) {
      existing.pane = pane;
      existing.blockHeight = blockHeight;
      existing.txHash = txHash;
    } else {
      this.marks.push({
        label,
        pane,
        blockHeight,
        txHash,
        pinned: false,
        createdAt: Date.now()
      });
    }

    if (this.persistence) {
      await this.persistence.put({
        label,
        pane,
        block_height: blockHeight,
        tx_hash: txHash,
        pinned: existing?.pinned || false
      });
    }
  }

  async removeByLabel(label: string) {
    this.marks = this.marks.filter(m => m.label !== label);

    if (this.persistence) {
      await this.persistence.del(label);
    }
  }

  getByLabel(label: string): Mark | undefined {
    return this.marks.find(m => m.label === label);
  }

  async setPinned(label: string, pinned: boolean) {
    const mark = this.marks.find(m => m.label === label);
    if (mark) {
      mark.pinned = pinned;
    }

    if (this.persistence) {
      await this.persistence.setPinned(label, pinned);
    }
  }

  async togglePin(label: string) {
    const mark = this.marks.find(m => m.label === label);
    if (!mark) return;

    await this.setPinned(label, !mark.pinned);
  }

  next(): Mark | undefined {
    if (this.marks.length === 0) return undefined;

    this.currentIndex = (this.currentIndex + 1) % this.marks.length;
    return this.marks[this.currentIndex];
  }

  prev(): Mark | undefined {
    if (this.marks.length === 0) return undefined;

    this.currentIndex = this.currentIndex <= 0 ? this.marks.length - 1 : this.currentIndex - 1;
    return this.marks[this.currentIndex];
  }
}
