import { supabase } from '../../lib/supabase';

interface PrizeConfig {
  label: string;
  amount: number;
  count: number;
}

const BATCH_SIZE = 250;

const PRIZE_DISTRIBUTION: PrizeConfig[] = [
  { label: 'RM0.50 Bonus', amount: 0.50, count: 100 },
  { label: 'RM1.0 Bonus', amount: 1.00, count: 50 },
  { label: 'RM2.0 Bonus', amount: 2.00, count: 30 },
  { label: 'RM5 Bonus', amount: 5.00, count: 10 },
  { label: 'RM10 Bonus', amount: 10.00, count: 5 },
  { label: 'RM20 Bonus', amount: 20.00, count: 5 },
  { label: 'No Bonus', amount: 0.00, count: 50 },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function generateEggPrizeBatchIfNeeded(
  batchNumber: number
): Promise<void> {
  console.log(`[EggGacha] Checking batch ${batchNumber}...`);

  const { data: existing, error: checkError } = await supabase
    .from('egg_prize_lines')
    .select('id')
    .eq('batch_number', batchNumber)
    .limit(1);

  if (checkError) {
    throw new Error(`Failed to check batch: ${checkError.message}`);
  }

  if (existing && existing.length > 0) {
    console.log(`[EggGacha] Batch ${batchNumber} already exists`);
    return;
  }

  console.log(`[EggGacha] Generating batch ${batchNumber}...`);

  const prizes: { label: string; amount: number }[] = [];
  for (const config of PRIZE_DISTRIBUTION) {
    for (let i = 0; i < config.count; i++) {
      prizes.push({ label: config.label, amount: config.amount });
    }
  }

  const shuffledPrizes = shuffleArray(prizes);
  const startLine = (batchNumber - 1) * BATCH_SIZE + 1;

  const rows = shuffledPrizes.map((prize, index) => ({
    line_number: startLine + index,
    batch_number: batchNumber,
    reward_label: prize.label,
    reward_amount: prize.amount,
    is_claimed: false,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: insertError } = await supabase
      .from('egg_prize_lines')
      .insert(chunk);

    if (insertError) {
      throw new Error(`Failed to insert batch: ${insertError.message}`);
    }
  }

  console.log(`[EggGacha] Batch ${batchNumber} created: ${rows.length} prizes`);
}

export async function checkAndGenerateNextEggBatches(): Promise<void> {
  const { count: claimedCount, error: countError } = await supabase
    .from('egg_prize_lines')
    .select('*', { count: 'exact', head: true })
    .eq('is_claimed', true);

  if (countError) {
    console.error('[EggGacha] Failed to count claimed');
    return;
  }

  const { data: maxBatchData, error: maxBatchError } = await supabase
    .from('egg_prize_lines')
    .select('batch_number')
    .order('batch_number', { ascending: false })
    .limit(1)
    .single();

  if (maxBatchError && maxBatchError.code !== 'PGRST116') {
    console.error('[EggGacha] Failed to get max batch');
    return;
  }

  const maxBatch = maxBatchData?.batch_number || 0;
  const totalClaimed = claimedCount || 0;

  console.log(`[EggGacha] Claimed: ${totalClaimed}, Max batch: ${maxBatch}`);

  if (totalClaimed >= 200 && maxBatch < 2) {
    await generateEggPrizeBatchIfNeeded(2);
  }
  if (totalClaimed >= 450 && maxBatch < 3) {
    await generateEggPrizeBatchIfNeeded(3);
  }
  if (totalClaimed >= 700 && maxBatch < 4) {
    await generateEggPrizeBatchIfNeeded(4);
  }
}

export async function initializeEggGachaSystem(): Promise<void> {
  const { count, error } = await supabase
    .from('egg_prize_lines')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to check system: ${error.message}`);
  }

  if (count === 0) {
    console.log('[EggGacha] Initializing system with batch 1...');
    await generateEggPrizeBatchIfNeeded(1);
  }
}
