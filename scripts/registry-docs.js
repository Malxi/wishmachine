// Shared registry document access for the registry actions: load the setup/outline
// pair and locate a mystery node in the outline tree. All actions (clean, abandon,
// repair, status) go through these so they read exactly the same documents.

import fs from 'node:fs';
import { MYSTERY_LIST_KEYS, SCENE_MYSTERY_LIST_KEYS } from './contracts.js';
import { readJson } from './util.js';
import { outlineFile, setupFile } from './paths.js';
import { outlineChapters } from './registry.js';

export function loadRegistryDocs(project) {
  const setupPath = setupFile(project.dir);
  const outlinePath = outlineFile(project.dir);
  if (!fs.existsSync(setupPath) || !fs.existsSync(outlinePath)) return null;
  try {
    return {
      setupFile: setupPath,
      outlineFile: outlinePath,
      setup: readJson(setupPath),
      outline: readJson(outlinePath),
    };
  } catch (error) {
    throw new Error(`registry documents could not be read: ${error.message}`);
  }
}

export function findMysteryNode(outline, id) {
  for (const chapter of outlineChapters(outline)) {
    for (const key of MYSTERY_LIST_KEYS) {
      const list = chapter.mysteries?.[key] || [];
      const index = list.findIndex((mystery) => mystery.id === id);
      if (index >= 0) return { chapter, key, index, mystery: list[index], scene: null };
    }
    for (const scene of chapter.scenes || []) {
      for (const key of SCENE_MYSTERY_LIST_KEYS) {
        const list = scene.mysteries?.[key] || [];
        const index = list.findIndex((mystery) => mystery.id === id);
        if (index >= 0) return { chapter, key, index, mystery: list[index], scene };
      }
    }
  }
  return null;
}
