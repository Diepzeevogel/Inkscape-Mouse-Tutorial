/**
 * Asset Loader
 * Centralized SVG fragment loading with caching
 * Eliminates duplicate SVG parsing and loading logic
 */

export class AssetLoader {
  constructor() {
    this.cache = new Map(); // Cache loaded SVG documents
    this.fragmentCache = new Map(); // Cache extracted fragments
  }

  /**
   * Load and parse an SVG document
   * @param {string} url - SVG file URL
   * @returns {Promise<Document>} Parsed SVG document
   */
  async loadSvgDocument(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const response = await fetch(url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      
      this.cache.set(url, doc);
      return doc;
    } catch (error) {
      console.error(`[AssetLoader] Failed to load SVG from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Find group fragments by ID or label
   * @param {string} url - SVG file URL
   * @param {Array<string>} identifiers - Element IDs to find
   * @returns {Promise<Object>} Map of identifier -> SVG fragment string
   */
  async findGroupFragments(url, identifiers) {
    const cacheKey = `${url}:${identifiers.join(',')}`;
    
    if (this.fragmentCache.has(cacheKey)) {
      return this.fragmentCache.get(cacheKey);
    }

    const doc = await this.loadSvgDocument(url);
    const results = {};

    // Collect root-level <defs> and <style> so fragments keep their styling
    const rootStyleDefs = Array.from(doc.querySelectorAll('defs, style'))
      .map(node => node.outerHTML)
      .join('');

    // First pass: Try to find by exact ID
    for (const id of identifiers) {
      const element = doc.getElementById(id);
      if (element) {
        results[id] = rootStyleDefs + element.outerHTML;
      }
    }

    // Second pass: Search in <g> elements by inkscape:label or title
    const groups = Array.from(doc.getElementsByTagName('g'));
    for (const group of groups) {
      const label = group.getAttribute('inkscape:label') || '';
      const titleElement = group.querySelector('title');
      const title = titleElement ? titleElement.textContent || '' : '';

      for (const id of identifiers) {
        if (results[id]) continue; // Already found

        const searchTerm = id.toLowerCase();
        if (
          (label && label.toLowerCase().includes(searchTerm)) ||
          (title && title.toLowerCase().includes(searchTerm))
        ) {
          results[id] = rootStyleDefs + group.outerHTML;
        }
      }
    }

    this.fragmentCache.set(cacheKey, results);
    return results;
  }

  /**
   * Create a Fabric.js group from SVG fragment
   * @param {string} svgFragment - SVG markup string
   * @returns {Promise<fabric.Group|null>} Fabric group object
   */
  makeFabricGroupFromFragment(svgFragment) {
    return new Promise((resolve) => {
      if (!svgFragment) {
        resolve(null);
        return;
      }

      // Wrap fragment in a minimal SVG root for Fabric.js compatibility
      const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">${svgFragment}</svg>`;
      
      fabric.loadSVGFromString(wrapped, (objects, options) => {
        if (!objects || objects.length === 0) {
          resolve(null);
          return;
        }

        const group = fabric.util.groupSVGElements(objects, options);
        resolve(group);
      });
    });
  }

  /**
   * Load multiple SVG fragments and create Fabric groups
   * @param {string} url - SVG file URL
   * @param {Array<string>} identifiers - Element IDs to load
   * @returns {Promise<Object>} Map of identifier -> Fabric group
   */
  async loadFabricGroups(url, identifiers) {
    const fragments = await this.findGroupFragments(url, identifiers);
    const groups = {};

    for (const id of identifiers) {
      const fragment = fragments[id];
      if (fragment) {
        groups[id] = await this.makeFabricGroupFromFragment(fragment);
      } else {
        console.warn(`[AssetLoader] Fragment not found for ID: ${id}`);
        groups[id] = null;
      }
    }

    return groups;
  }

  /**
   * Clear all caches (useful for development/hot reload)
   */
  clearCache() {
    this.cache.clear();
    this.fragmentCache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats() {
    return {
      documents: this.cache.size,
      fragments: this.fragmentCache.size
    };
  }
}

// Singleton instance for convenience
export const assetLoader = new AssetLoader();
