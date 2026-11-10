import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, readJson, readText, writeJsonAtomic, writeTextAtomic,
  resolveProjectDir, nowIso, stamp, deepMerge, safeSegment, parseJson,
} from './util.js';
import { validateSetup, validateOutline, validateCraft, validateRecap, checkProject, outlineIndex } from './schema.js';

export function initProject(options) {
  const name = String(options.name || '').trim();
  if (!name) throw new Error('book name is required');
  const parts = Number(options.parts || 1);
  const volumes = Number(options.volumes || 1);
  const chapters = Number(options.chapter || options.chapters || 20);
  if (parts <= 0 || volumes <= 0 || chapters <= 0) {
    throw new Error('--parts, --volumes and --chapter must be positive');
  }
  const dir = path.resolve(options.dir || name);
  if (fs.existsSync(path.join(dir, 'novel.json'))) {
    throw new Error(`a Wishmachine project already exists at ${dir}`);
  }
  ensureDir(dir);
  const now = nowIso();
  const config = {
    name,
    version: '1.0.0',
    created_at: now,
    updated_at: now,
    language: options.language || 'zh',
    genres: options.genre ? String(options.genre).split(',').map((s) => s.trim()).filter(Boolean) : ['未分类'],
    structure: {
      target_parts: parts,
      target_volumes: volumes,
      target_chapters: chapters,
    },
  };
  for (const sub of ['story/setup', 'story/compose', 'story/craft', 'story/reviews', 'chapters', 'drafts', 'logs']) {
    ensureDir(path.join(dir, sub));
  }
  writeJsonAtomic(path.join(dir, 'novel.json'), config);
  writeTextAtomic(path.join(dir, 'story', 'setup', 'story_setup.md'), setupPlaceholder(name, config.genres));
  return { dir, config };
}

function setupPlaceholder(name, genres) {
  return `# ${name}\n\n## Story Setup\n\n### Genre(s)\n${genres.map((g) => `- ${g}`).join('\n')}\n\n### Core Premise\n(待填写)\n\n### Theme\n(待填写)\n\n### Story Rules/Constraints\n- (待填写)\n`;
}

export function loadProject(explicit) {
  const dir = resolveProjectDir(explicit);
  const configFile = path.join(dir, 'novel.json');
  if (!fs.existsSync(configFile)) {
    throw new Error(`no novel.json found at ${dir}; run book init first`);
  }
  return { dir, config: readJson(configFile) };
}

export function projectStatus(project) {
  const config = project.config;
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  const setup = fs.existsSync(setupFile);
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
  const chapters = [];
  if (outline) {
    for (const part of outline.parts || []) {
      for (const volume of part.volumes || []) {
        for (const chapter of volume.chapters || []) {
          chapters.push({
            id: chapter.id,
            title: chapter.title,
            volume_id: volume.id,
            written: fs.existsSync(path.join(project.dir, 'chapters', `${chapter.id}.md`)),
          });
        }
      }
    }
  }
  let next;
  if (!setup) {
    next = { stage: 'setup', targetId: 'setup', reason: '故事设定尚未生成。' };
  } else if (!outline) {
    next = { stage: 'outline', targetId: 'outline', reason: '大纲尚未生成。' };
  } else {
    const unwritten = chapters.find((chapter) => !chapter.written);
    next = unwritten
      ? { stage: 'write', targetId: `chapter:${unwritten.id}`, reason: '仍有章节未写正文。' }
      : { stage: 'complete', targetId: '', reason: '全部章节已写正文。' };
  }
  return {
    name: config.name,
    root: project.dir,
    setup,
    structure: config.structure,
    outline: outline ? {
      parts: outline.parts?.length || 0,
      volumes: (outline.parts || []).reduce((n, p) => n + (p.volumes?.length || 0), 0),
      chapters: (outline.parts || []).reduce((n, p) => n + (p.volumes || []).reduce((m, v) => m + (v.chapters?.length || 0), 0), 0),
    } : { parts: 0, volumes: 0, chapters: 0 },
    chapters,
    next,
  };
}

export function projectState(project, options = {}) {
  const status = projectStatus(project);
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  const setup = fs.existsSync(setupFile) ? readJson(setupFile) : null;
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
  const craftDir = path.join(project.dir, 'story', 'craft');
  const recapDir = path.join(project.dir, 'story', 'recaps');
  const files = (dir) => fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => ({
      name: name.slice(0, -5),
      size: fs.statSync(path.join(dir, name)).size,
    }))
    : [];
  const view = options.view === 'full' ? 'full' : 'brief';
  const clip = (text, max) => {
    const value = String(text || '');
    return value.length > max ? `${value.slice(0, max)}…` : value;
  };
  const state = {
    project: {
      name: status.name,
      root: status.root,
      language: project.config.language || '',
      structure: status.structure,
    },
    setup: setup ? {
      present: true,
      project_name: setup.project_name || status.name,
      genres: setup.genres || [],
      premise: clip(setup.premise, 300),
      theme: clip(setup.theme, 180),
      cast: (setup.core_cast || []).map((item) => ({ name: item.name, role: item.role, importance: item.importance })),
      storyline_count: (setup.storylines || []).length,
      premise_count: (setup.premises || []).length,
      resource_count: (setup.world_resources || []).length,
    } : { present: false },
    outline: outline ? outlineIndex(outline) : null,
    chapters: status.chapters,
    chapter_count: status.chapters.length,
    written_count: status.chapters.filter((chapter) => chapter.written).length,
    craft: files(craftDir),
    recaps: files(recapDir),
    next: status.next,
  };
  if (view === 'full') {
    state.setup_full = setup;
    state.outline_full = outline;
  }
  return { ok: true, view, state };
}

export function readSection(project, section, options = {}) {
  const id = options.id ? safeSegment(options.id) : '';
  const view = options.view || 'brief';
  switch (section) {
    case 'setup': {
      const file = path.join(project.dir, 'story', 'setup', 'story_setup.json');
      if (!fs.existsSync(file)) throw new Error('story setup has not been written yet');
      return { ok: true, section, setup: readJson(file) };
    }
    case 'outline': {
      const file = path.join(project.dir, 'story', 'compose', 'outline.json');
      if (!fs.existsSync(file)) throw new Error('outline has not been written yet');
      const outline = readJson(file);
      if (id) {
        for (const part of outline.parts || []) {
          for (const volume of part.volumes || []) {
            if (volume.id === id) return { ok: true, section, volume };
            for (const chapter of volume.chapters || []) {
              if (chapter.id === id) return { ok: true, section, chapter };
            }
          }
        }
        throw new Error(`outline id not found: ${id}`);
      }
      return { ok: true, section, outline: view === 'index' ? outlineIndex(outline) : outline };
    }
    case 'chapter': {
      if (!id) throw new Error('book read chapter requires --id');
      const file = path.join(project.dir, 'chapters', `${id}.md`);
      if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
      return { ok: true, section, id, content: readText(file) };
    }
    case 'recap': {
      if (!id) throw new Error('book read recap requires --id');
      const file = path.join(project.dir, 'story', 'recaps', `${id}.json`);
      if (!fs.existsSync(file)) throw new Error(`recap not found: ${id}`);
      return { ok: true, section, id, recap: readJson(file) };
    }
    case 'craft': {
      const dir = path.join(project.dir, 'story', 'craft');
      if (!fs.existsSync(dir)) return { ok: true, section, results: [] };
      if (id) {
        const file = path.join(dir, `${id}.json`);
        if (!fs.existsSync(file)) throw new Error(`craft file not found: ${id}`);
        return { ok: true, section, id, craft: readJson(file) };
      }
      const results = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((name) => ({
        name: name.slice(0, -5),
        size: fs.statSync(path.join(dir, name)).size,
      }));
      return { ok: true, section, results };
    }
    case 'context': {
      return { ok: true, section, status: projectStatus(project), outline: fs.existsSync(path.join(project.dir, 'story', 'compose', 'outline.json'))
        ? outlineIndex(readJson(path.join(project.dir, 'story', 'compose', 'outline.json')))
        : null };
    }
    case 'logs': {
      const dir = path.join(project.dir, 'logs');
      const results = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
      return { ok: true, section, results };
    }
    default:
      throw new Error(`unsupported read section: ${section}`);
  }
}

function checkpoint(file, name) {
  if (!fs.existsSync(file)) return;
  const dir = path.join(path.dirname(file), 'checkpoints');
  ensureDir(dir);
  const target = path.join(dir, `${name}_${stamp()}.json`);
  fs.copyFileSync(file, target);
}

function setupMarkdown(setup) {
  const lines = [`# ${setup.project_name || 'Story Setup'}`, ''];
  for (const [key, label] of [['premise', 'Premise'], ['theme', 'Theme'], ['tone', 'Tone'], ['target_audience', 'Audience']]) {
    if (setup[key]) lines.push(`## ${label}`, '', String(setup[key]), '');
  }
  if (setup.rules?.length) lines.push('## Rules', '', ...setup.rules.map((r) => `- ${r}`), '');
  return lines.join('\n');
}

function outlineMarkdown(outline) {
  const lines = [];
  for (const part of outline.parts || []) {
    lines.push(`# ${part.title || part.id}`, '', part.summary || '', '');
    for (const volume of part.volumes || []) {
      lines.push(`## ${volume.title || volume.id}`, '', volume.summary || '', '');
      for (const chapter of volume.chapters || []) {
        lines.push(`### ${chapter.id} ${chapter.title || ''}`, '', chapter.summary || '', '');
      }
    }
  }
  return lines.join('\n');
}

function shapeCheck(section, candidate, config, kind) {
  let findings;
  if (section === 'setup') findings = validateSetup(candidate);
  else if (section === 'outline') findings = validateOutline(candidate, config);
  else if (section === 'craft') findings = validateCraft(candidate, kind || 'character');
  else if (section === 'recap') findings = validateRecap(candidate);
  else findings = [];
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) summary[f.severity] += 1;
  return {
    ok: summary.critical === 0 && summary.high === 0,
    blocking: summary.critical > 0 || summary.high > 0,
    profile: 'schema',
    target: section,
    score: Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 4 - summary.low),
    summary,
    findings,
  };
}

export function writeArtifact(project, options) {
  const section = options.section;
  const mode = options.mode || 'replace';
  const apply = Boolean(options.apply);
  const raw = options.content ?? '';
  const id = options.id ? safeSegment(options.id) : '';
  let candidate;
  let file;
  let isJson = true;

  if (section === 'setup') {
    file = path.join(project.dir, 'story', 'setup', 'story_setup.json');
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'setup patch'))
      : parseJson(raw, 'setup');
    candidate = incoming;
  } else if (section === 'outline') {
    file = path.join(project.dir, 'story', 'compose', 'outline.json');
    if (mode === 'patch') {
      const current = fs.existsSync(file) ? readJson(file) : { parts: [] };
      const patch = parseJson(raw, 'outline patch');
      if (options.target === 'volume') {
        if (!id) throw new Error('outline volume patch requires --id');
        let volume;
        for (const part of current.parts || []) {
          volume = (part.volumes || []).find((v) => v.id === id);
          if (volume) break;
        }
        if (!volume) throw new Error(`outline volume not found: ${id}`);
        Object.assign(volume, deepMerge(volume, patch));
        candidate = current;
      } else {
        candidate = deepMerge(current, patch);
      }
    } else {
      candidate = parseJson(raw, 'outline');
    }
  } else if (section === 'chapter') {
    if (!id) throw new Error('chapter write requires --id');
    file = path.join(project.dir, 'chapters', `${id}.md`);
    isJson = false;
    candidate = raw;
    if (!candidate.trim()) throw new Error('chapter content is empty');
  } else if (section === 'craft') {
    const kind = options.target || 'character';
    file = path.join(project.dir, 'story', 'craft', `${kind}.json`);
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'craft patch'))
      : parseJson(raw, 'craft');
    candidate = incoming;
  } else if (section === 'recap') {
    if (!id) throw new Error('recap write requires --id');
    file = path.join(project.dir, 'story', 'recaps', `${id}.json`);
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'recap patch'))
      : parseJson(raw, 'recap');
    candidate = incoming;
  } else {
    throw new Error(`unsupported write section: ${section}`);
  }

  const shape = isJson && ['setup', 'outline', 'craft', 'recap'].includes(section)
    ? shapeCheck(section, candidate, project.config, options.target || 'character')
    : null;
  const check = shape || (section === 'chapter' ? {
    ok: true, blocking: false, profile: 'schema', target: 'chapter', id,
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 }, findings: [],
  } : null);

  if (check?.blocking && apply) {
    return { ok: false, applied: false, dry_run: false, section, check };
  }
  if (!apply) {
    return { ok: check?.ok ?? true, applied: false, dry_run: true, section, id, check };
  }

  checkpoint(file, section);
  if (isJson) {
    writeJsonAtomic(file, candidate);
  } else {
    writeTextAtomic(file, candidate.endsWith('\n') ? candidate : `${candidate}\n`);
  }
  if (section === 'setup') {
    writeTextAtomic(path.join(project.dir, 'story', 'setup', 'story_setup.md'), setupMarkdown(candidate));
  }
  if (section === 'outline') {
    writeTextAtomic(path.join(project.dir, 'story', 'compose', 'outline.md'), outlineMarkdown(candidate));
  }
  const config = readJson(path.join(project.dir, 'novel.json'));
  config.updated_at = nowIso();
  writeJsonAtomic(path.join(project.dir, 'novel.json'), config);
  const after = ['setup', 'outline', 'craft', 'recap'].includes(section)
    ? checkProject({ ...project, config }, {
      profile: 'all',
      target: section,
      id: section === 'craft' ? (options.target || 'character') : id,
      maxFindings: options.maxIssues || 0,
    })
    : null;
  return { ok: true, applied: true, dry_run: false, section, id, changed: true, check: after || check };
}
