// Every approved source. Each one has the same chance of being drawn when a box opens.
// A fetch either returns a raw discovery or throws; the resolver validates the result.
import art from './sources/art.js';
import space from './sources/space.js';
import earth from './sources/earth.js';
import nature from './sources/nature.js';
import science from './sources/science.js';
import knowledge from './sources/knowledge.js';
import fun from './sources/fun.js';
import entertainment from './sources/entertainment.js';
import everyday from './sources/everyday.js';
import research from './sources/research.js';
import world from './sources/world.js';
import additional from './sources/additional.js';
import openAccess from './sources/open-access.js';
import questions from './sources/questions.js';
import bibliographic from './sources/bibliographic.js';
import observations from './sources/observations.js';
import { SOURCE_POLICIES } from './sources/policies.js';

export { text } from './sources/util.js';

// These broad/adult-oriented feeds are not suitable for an unrestricted family-facing draw.
const SAFETY_DISABLED = new Set(['rickAndMorty', 'futurama', 'devto', 'figshare', 'wikinews', 'internetArchive', 'wellcome']);

// Reviewed replacements supersede legacy adapters without creating duplicate lottery entries.
const reviewed = [...openAccess, ...questions, ...bibliographic, ...observations];
const IMAGE_ADAPTERS = new Set(openAccess.filter(source => source.visualType === 'image').map(source => source.id));
// Admission requires reviewed provider-supplied media, not a chart rendered from raw data.
const VISUAL_ADAPTERS = IMAGE_ADAPTERS;
const replacements = new Map(reviewed.map(source => [source.id, source]));
const legacy = [...art, ...space, ...earth, ...nature, ...science, ...knowledge, ...fun, ...entertainment, ...everyday, ...research, ...world, ...additional];
export const SOURCES = [...legacy.map(source => replacements.get(source.id) || source), ...reviewed.filter(source => !legacy.some(old => old.id === source.id))]
  .map(source => ({ ...source, rightsPolicy: SOURCE_POLICIES[source.id] || null,
    imageCapable: IMAGE_ADAPTERS.has(source.id),
    visualCapable: VISUAL_ADAPTERS.has(source.id),
    enabled: source.enabled !== false && Boolean(SOURCE_POLICIES[source.id]) && SOURCE_POLICIES[source.id].available !== false && VISUAL_ADAPTERS.has(source.id) && !SAFETY_DISABLED.has(source.id) }));
