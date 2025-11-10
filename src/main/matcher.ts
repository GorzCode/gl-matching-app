/**
 * TYPES AND INTERFACES
 */

export interface BankTransaction {
  date: Date;
  type: 'Deposit' | 'Withdrawal';
  vendor: string;
  description: string;
  amount: number;
  sourceFile: string;
  matched?: boolean;
}

export interface QBTransaction {
  date: Date;
  transNumber: string;
  type: string;
  account?: string;
  name: string;
  memo: string;
  split: string;
  debit: number;
  credit: number;
  amount: number;
  matched?: boolean;
}

export interface MatchedPair {
  matchType: string;
  bankDate: Date;
  qbDate: Date;
  amount: number;
  bankType: string;
  bankVendor: string;
  bankDescription: string;
  qbTransNumber: string;
  qbType: string;
  qbName: string;
  qbMemo: string;
  qbSplit: string;
}

export interface ReconciliationResult {
  matched: MatchedPair[];
  unmatchedBank: BankTransaction[];
  unmatchedQB: QBTransaction[];
  matchRate: number;
  totalBank: number;
  totalQB: number;
}

/**
 * MATCHING ENGINE
 */

export class GLMatcher {
  private bankTransactions: BankTransaction[] = [];
  private qbTransactions: QBTransaction[] = [];
  private matched: MatchedPair[] = [];
  private additionalMappings: { [key: string]: string[] } = {};

  constructor(bank: BankTransaction[], qb: QBTransaction[], additionalMappings?: { [key: string]: string[] }) {
    this.bankTransactions = bank.map(t => ({ ...t, matched: false }));
    this.qbTransactions = qb.map(t => ({ ...t, matched: false }));
    this.additionalMappings = additionalMappings || {};
  }

  /**
   * Run all matching passes
   */
  public match(): ReconciliationResult {
    console.log('Starting matching process...');
    
    // Pass 1: Exact match (date + amount)
    const pass1 = this.exactMatch();
    console.log(`Pass 1 (Exact): ${pass1} matches`);

    // Pass 2: Near date ±3 days
    const pass2 = this.nearDateMatch(3);
    console.log(`Pass 2 (±3 days): ${pass2} matches`);

    // Pass 3: Near date ±7 days
    const pass3 = this.nearDateMatch(7);
    console.log(`Pass 3 (±7 days): ${pass3} matches`);

    // Pass 4: Transaction splits
    const pass4 = this.splitMatch();
    console.log(`Pass 4 (Splits): ${pass4} matches`);

    // Pass 5: Fuzzy amount (±$1)
    const pass5 = this.fuzzyAmountMatch();
    console.log(`Pass 5 (Fuzzy): ${pass5} matches`);

    // Pass 6: Vendor + type compatible
    const pass6 = this.vendorTypeMatch();
    console.log(`Pass 6 (Vendor): ${pass6} matches`);

    const unmatchedBank = this.bankTransactions.filter(t => !t.matched);
    const unmatchedQB = this.qbTransactions.filter(t => !t.matched);

    return {
      matched: this.matched,
      unmatchedBank,
      unmatchedQB,
      matchRate: (this.matched.length / this.bankTransactions.length) * 100,
      totalBank: this.bankTransactions.length,
      totalQB: this.qbTransactions.length
    };
  }

  /**
   * Pass 1: Exact date and amount match
   */
  private exactMatch(): number {
    let count = 0;

    for (let i = 0; i < this.bankTransactions.length; i++) {
      const bank = this.bankTransactions[i];
      if (bank.matched) continue;

      const bankAmount = Math.abs(bank.amount);
      const candidates = this.qbTransactions.filter(qb => 
        !qb.matched &&
        this.isSameDay(bank.date, qb.date) &&
        this.getQBAmount(qb, bank.type) === bankAmount
      );

      if (candidates.length === 1) {
        this.createMatch('Exact', bank, candidates[0], i, this.qbTransactions.indexOf(candidates[0]));
        count++;
      }
    }

    return count;
  }

  /**
   * Pass 2 & 3: Near date match (within days window)
   */
  private nearDateMatch(days: number): number {
    let count = 0;

    for (let i = 0; i < this.bankTransactions.length; i++) {
      const bank = this.bankTransactions[i];
      if (bank.matched) continue;

      const bankAmount = Math.abs(bank.amount);
      const candidates = this.qbTransactions.filter(qb => 
        !qb.matched &&
        this.isWithinDays(bank.date, qb.date, days) &&
        this.getQBAmount(qb, bank.type) === bankAmount
      );

      if (candidates.length === 1) {
        this.createMatch(`Near Date (±${days}d)`, bank, candidates[0], i, this.qbTransactions.indexOf(candidates[0]));
        count++;
      }
    }

    return count;
  }

  /**
   * Pass 4: Transaction splits (2-3 QB entries sum to one bank entry)
   */
  private splitMatch(): number {
    let count = 0;

    for (let i = 0; i < this.bankTransactions.length; i++) {
      const bank = this.bankTransactions[i];
      if (bank.matched) continue;

      const bankAmount = Math.abs(bank.amount);
      const candidates = this.qbTransactions.filter(qb =>
        !qb.matched &&
        this.isWithinDays(bank.date, qb.date, 5) &&
        this.getQBAmount(qb, bank.type) > 0
      );

      if (candidates.length < 2) continue;

      // Try 2-transaction splits
      for (let j = 0; j < candidates.length - 1; j++) {
        for (let k = j + 1; k < candidates.length; k++) {
          const sum = this.getQBAmount(candidates[j], bank.type) + this.getQBAmount(candidates[k], bank.type);
          if (Math.abs(sum - bankAmount) < 0.01) {
            this.createSplitMatch(
              `Split (2 transactions)`,
              bank,
              [candidates[j], candidates[k]],
              i,
              [this.qbTransactions.indexOf(candidates[j]), this.qbTransactions.indexOf(candidates[k])]
            );
            count++;
            break;
          }
        }
        if (bank.matched) break;
      }

      if (bank.matched) continue;

      // Try 3-transaction splits
      for (let j = 0; j < candidates.length - 2; j++) {
        for (let k = j + 1; k < candidates.length - 1; k++) {
          for (let l = k + 1; l < candidates.length; l++) {
            const sum = 
              this.getQBAmount(candidates[j], bank.type) + 
              this.getQBAmount(candidates[k], bank.type) + 
              this.getQBAmount(candidates[l], bank.type);
            
            if (Math.abs(sum - bankAmount) < 0.01) {
              this.createSplitMatch(
                `Split (3 transactions)`,
                bank,
                [candidates[j], candidates[k], candidates[l]],
                i,
                [
                  this.qbTransactions.indexOf(candidates[j]),
                  this.qbTransactions.indexOf(candidates[k]),
                  this.qbTransactions.indexOf(candidates[l])
                ]
              );
              count++;
              break;
            }
          }
          if (bank.matched) break;
        }
        if (bank.matched) break;
      }
    }

    return count;
  }

  /**
   * Pass 5: Fuzzy amount matching (within $1 for rounding)
   */
  private fuzzyAmountMatch(): number {
    let count = 0;

    for (let i = 0; i < this.bankTransactions.length; i++) {
      const bank = this.bankTransactions[i];
      if (bank.matched) continue;

      const bankAmount = Math.abs(bank.amount);
      const candidates = this.qbTransactions.filter(qb => 
        !qb.matched &&
        this.isWithinDays(bank.date, qb.date, 3) &&
        Math.abs(this.getQBAmount(qb, bank.type) - bankAmount) <= 1.0
      );

      if (candidates.length === 1) {
        this.createMatch('Fuzzy Amount', bank, candidates[0], i, this.qbTransactions.indexOf(candidates[0]));
        count++;
      }
    }

    return count;
  }

  /**
   * Pass 6: Vendor name + type compatible matching
   */
  private vendorTypeMatch(): number {
    let count = 0;

    for (let i = 0; i < this.bankTransactions.length; i++) {
      const bank = this.bankTransactions[i];
      if (bank.matched) continue;

      const bankAmount = Math.abs(bank.amount);
      // Pass description for Zelle name extraction
      const bankVendorNorm = this.normalizeVendor(bank.vendor, bank.description);

      const candidates = this.qbTransactions.filter(qb =>
        !qb.matched &&
        this.isWithinDays(bank.date, qb.date, 3) &&
        this.getQBAmount(qb, bank.type) === bankAmount &&
        this.typesAreCompatible(bank.type, qb.type)
      );

      for (const candidate of candidates) {
        const qbVendorNorm = this.normalizeVendor(candidate.name);
        const similarity = this.similarityScore(bankVendorNorm, qbVendorNorm);

        if (similarity > 0.6 || (bankVendorNorm === qbVendorNorm && bankVendorNorm !== '')) {
          this.createMatch(
            `Vendor+Type (${Math.round(similarity * 100)}% similar)`,
            bank,
            candidate,
            i,
            this.qbTransactions.indexOf(candidate)
          );
          count++;
          break;
        }
      }
    }

    return count;
  }

  /**
   * Create a single match
   */
  private createMatch(matchType: string, bank: BankTransaction, qb: QBTransaction, bankIdx: number, qbIdx: number): void {
    this.matched.push({
      matchType,
      bankDate: bank.date,
      qbDate: qb.date,
      amount: Math.abs(bank.amount),
      bankType: bank.type,
      bankVendor: bank.vendor,
      bankDescription: bank.description,
      qbTransNumber: qb.transNumber,
      qbType: qb.type,
      qbName: qb.name,
      qbMemo: qb.memo,
      qbSplit: qb.split
    });

    this.bankTransactions[bankIdx].matched = true;
    this.qbTransactions[qbIdx].matched = true;
  }

  /**
   * Create a split match (multiple QB entries to one bank)
   */
  private createSplitMatch(
    matchType: string, 
    bank: BankTransaction, 
    qbs: QBTransaction[], 
    bankIdx: number, 
    qbIndices: number[]
  ): void {
    this.matched.push({
      matchType,
      bankDate: bank.date,
      qbDate: qbs[0].date,
      amount: Math.abs(bank.amount),
      bankType: bank.type,
      bankVendor: bank.vendor,
      bankDescription: bank.description,
      qbTransNumber: qbs.map(q => q.transNumber).join(', '),
      qbType: 'Multiple',
      qbName: qbs.map(q => q.name).join(', '),
      qbMemo: qbs.map(q => q.memo).join(' | '),
      qbSplit: qbs.map(q => q.split).join(' | ')
    });

    this.bankTransactions[bankIdx].matched = true;
    qbIndices.forEach(idx => {
      this.qbTransactions[idx].matched = true;
    });
  }

  /**
   * Helper: Get QB amount based on bank transaction type
   */
  private getQBAmount(qb: QBTransaction, bankType: 'Deposit' | 'Withdrawal'): number {
    return bankType === 'Deposit' ? qb.debit : qb.credit;
  }

  /**
   * Helper: Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Helper: Check if dates are within N days (INCLUSIVE of exact same day)
   * Python: (qb_date >= bank_date - timedelta(days=N)) & (qb_date <= bank_date + timedelta(days=N))
   */
  private isWithinDays(date1: Date, date2: Date, days: number): boolean {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    return daysDiff <= days;
  }

  /**
   * Helper: Normalize vendor name
   * For Zelle transactions, extract person's name from description
   */
  private normalizeVendor(vendor: string, description?: string): string {
    if (!vendor) return '';

    let normalized = vendor.toUpperCase().trim();

    // Special handling for Zelle - extract person name from description
    if (normalized === 'ZELLE' && description) {
      const desc = description.toUpperCase();
      // Pattern: "ZELLE PAYMENT TO [NAME] [JPM...]"
      const zelleMatch = desc.match(/ZELLE PAYMENT (?:TO|FROM)\s+([A-Z\s]+?)(?:\s+JPM|$)/);
      if (zelleMatch && zelleMatch[1]) {
        // Get first word of person's name (e.g., "PAUL ODEA" -> "PAUL")
        const personName = zelleMatch[1].trim();
        const firstWord = personName.split(/\s+/)[0];
        return firstWord;
      }
    }

    // Vendor mappings (base + AI-generated)
    const mappings: { [key: string]: string[] } = {
      'CITI CARD': ['CITIBANK', 'CITI CARD ONLINE', 'CITICTP'],
      'BANK OF AMERICA': ['BK OF', 'BK OF AMER VISA', 'BANK OF AMERICA'],
      'CHASE': ['CHASE CREDIT CARD', 'CHASE CARD', 'CHASE BANK'],
      'SBA': ['SBA LOAN', 'SBA EIDL', 'SBA EIDL LOAN'],
      'BRANDUSA': ['BRANDUSA NIRO', 'BRANDUSA'],
      'KATERINA': ['KATRINA', 'KATERINA OHANYAN', 'KATRINA OHANYAN'],
      ...this.additionalMappings  // Merge AI-generated mappings
    };

    for (const [key, variants] of Object.entries(mappings)) {
      for (const variant of variants) {
        if (normalized.includes(variant)) {
          return key;
        }
      }
    }

    // Remove common prefixes
    normalized = normalized
      .replace('ORIG CO NAME:', '')
      .replace('PAYMENT TO', '')
      .replace('ZELLE PAYMENT TO', '')
      .replace('ZELLE PAYMENT FROM', '')
      .trim();

    // Get first significant word
    const words = normalized.split(/\s+/);
    return words.length > 0 ? words[0] : normalized;
  }

  /**
   * Helper: Check if bank and QB types are compatible
   */
  private typesAreCompatible(bankType: string, qbType: string): boolean {
    if (bankType === 'Deposit') {
      return ['Deposit', 'Payment', 'Sales Receipt', 'Invoice Payment'].includes(qbType);
    }
    if (bankType === 'Withdrawal') {
      return ['Check', 'Bill Pmt -Check', 'Transfer', 'Expense', 'Credit Card'].includes(qbType);
    }
    return false;
  }

  /**
   * Helper: Calculate string similarity (0-1)
   */
  private similarityScore(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toUpperCase();
    const s2 = str2.toUpperCase();
    
    if (s1 === s2) return 1;

    // Simple Levenshtein-based similarity
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Helper: Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
