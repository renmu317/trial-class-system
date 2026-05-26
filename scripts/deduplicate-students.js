/**
 * 清理重复的 student 记录
 *
 * 逻辑：
 * 1. 找出同一个 session 里同名的 student（不区分大小写）
 * 2. 保留最早创建的那一条（primary）
 * 3. 把其他重复记录的 agent_sessions / student_events 合并到 primary
 * 4. 删除重复记录
 *
 * 运行方式：
 * node scripts/deduplicate-students.js              # Dry run
 * node scripts/deduplicate-students.js --confirm    # 实际执行
 *
 * 注意：运行前先备份数据库！
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aebxtunvdtabhdtihglh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variable required');
  console.error('Usage: SUPABASE_SERVICE_KEY=xxx node scripts/deduplicate-students.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findDuplicates() {
  // Step 1: 获取所有 students
  const { data: allStudents, error } = await supabase
    .from('students')
    .select('id, name, session_id, created_at, game_name')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch students:', error);
    return null;
  }

  // Step 2: 按 session_id + name(lowercase) 分组
  const groups = {};
  for (const student of allStudents) {
    const key = `${student.session_id}::${student.name.toLowerCase().trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(student);
  }

  // Step 3: 找出有重复的组
  return Object.entries(groups)
    .filter(([, students]) => students.length > 1);
}

async function deduplicateStudents() {
  console.log('🔍 Finding duplicate students...\n');

  const duplicateGroups = await findDuplicates();

  if (!duplicateGroups) return;

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found. Database is clean.');
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups:\n`);

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const [key, students] of duplicateGroups) {
    const [sessionId, name] = key.split('::');
    const primary = students[0];  // 最早创建的
    const duplicates = students.slice(1);

    console.log(`\n📋 "${name}" in session ${sessionId.slice(0, 8)}...`);
    console.log(`   Primary: ${primary.id.slice(0, 8)}... (created: ${new Date(primary.created_at).toLocaleString()})`);
    console.log(`   Duplicates: ${duplicates.length} records`);

    for (const dup of duplicates) {
      // 合并 agent_sessions
      const { data: agentSessions } = await supabase
        .from('agent_sessions')
        .update({ student_id: primary.id })
        .eq('student_id', dup.id)
        .select('id');

      const agentCount = agentSessions?.length || 0;

      // 合并 student_events
      const { data: events } = await supabase
        .from('student_events')
        .update({ student_id: primary.id })
        .eq('student_id', dup.id)
        .select('id');

      const eventCount = events?.length || 0;

      // 合并 student_signals（可能会有冲突，先删后插或跳过）
      await supabase
        .from('student_signals')
        .delete()
        .eq('student_id', dup.id);

      // 合并 conversion_signals
      await supabase
        .from('conversion_signals')
        .update({ student_id: primary.id })
        .eq('student_id', dup.id);

      console.log(`   ✓ Merged ${agentCount} agent_sessions, ${eventCount} events from ${dup.id.slice(0, 8)}...`);

      // 删除重复 student 记录
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', dup.id);

      if (deleteError) {
        console.error(`   ✗ Failed to delete ${dup.id}:`, deleteError.message);
      } else {
        totalDeleted++;
      }

      totalMerged++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Merged and deleted ${totalDeleted} duplicate records`);
  console.log(`   Affected ${duplicateGroups.length} students`);
}

async function deduplicateStudents_dryRun() {
  console.log('🔍 [DRY RUN] Finding duplicate students...\n');

  const duplicateGroups = await findDuplicates();

  if (!duplicateGroups) return;

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found. Database is clean.');
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups:\n`);

  let totalToDelete = 0;

  for (const [key, students] of duplicateGroups) {
    const [sessionId, name] = key.split('::');
    const primary = students[0];
    const duplicates = students.slice(1);

    console.log(`📋 "${name}" in session ${sessionId.slice(0, 8)}...`);
    console.log(`   Would keep: ${primary.id.slice(0, 8)}... (${primary.game_name || 'no game name'})`);
    console.log(`   Would delete: ${duplicates.length} records`);

    for (const dup of duplicates) {
      // 统计相关数据
      const { count: agentCount } = await supabase
        .from('agent_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', dup.id);

      const { count: eventCount } = await supabase
        .from('student_events')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', dup.id);

      console.log(`     - ${dup.id.slice(0, 8)}...: ${agentCount || 0} agent_sessions, ${eventCount || 0} events`);
    }

    totalToDelete += duplicates.length;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`   Total records to delete: ${totalToDelete}`);
  console.log(`\n⚠️  To actually run, use: node scripts/deduplicate-students.js --confirm`);
}

// 安全确认
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  console.log('⚠️  Running in CONFIRM mode - changes will be made!\n');
  deduplicateStudents().catch(console.error);
} else {
  deduplicateStudents_dryRun().catch(console.error);
}
