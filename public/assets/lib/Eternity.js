/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */

/**
 * Eternity JS -- minimal Web frontend framework
 * Copyright (C) 2022 Menhera.org
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * @file
 */

import "./es-first-aid.js";

const STORAGE_KEY_SESSION_ID = 'menhera.session_id';
const STORAGE_KEY_CLIENT_ID = 'menhera.client_id';
const STORAGE_KEY_BROADCAST = 'menhera.broadcast';
const STORAGE_KEY_PREFIX_STATE = 'menhera.state';

const TOPIC_SCOPE_CLIENT = 'client';
const TOPIC_SCOPE_SESSION = 'session';
const TOPIC_SCOPE_INSTANCE = 'instance';
const TOPIC_SCOPES = new Set([
  TOPIC_SCOPE_CLIENT,
  TOPIC_SCOPE_SESSION,
  TOPIC_SCOPE_INSTANCE,
]);

/**
 * 
 * @param callback {function}
 * @param args {any[]}
 */
const callTruelyAsync = (callback, ... args) => 
  new Promise((res) => setTimeout(res, 0)).then(() => callback(... args));

/**
 * 
 * @param callback {function}
 * @param args {any[]}
 */
const callMaybeAsync = (callback, ... args) => {
  try {
    return Promise.resolve(callback(... args));
  } catch (e) {
    return Promise.reject(e);
  }
};

/**
 * 
 * @param callback {function}
 * @param args {any[]}
 */
const callMaybeAsyncIgnoringError = (callback, ... args) => {
  callMaybeAsync(callback, ... args).catch((e) => console.error(e));
};

let clientIdCache = null;

/**
* 
* @returns {string}
*/
const getClientId = () => {
  if (clientIdCache) return clientIdCache;
  try {
      const clientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
      if (!clientId) throw void 0;
      clientIdCache = clientId;
      return clientId;
  } catch (e) {}
  
  const clientId = firstAid.getRandomUuid();
  clientIdCache = clientId;
  try {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId);
  } finally {
      return clientId;
  }
};

let sessionIdCache = null;

/**
* 
* @returns {string}
*/
const getSessionId = () => {
  if (sessionIdCache) return sessionIdCache;
  try {
      const sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
      if (!sessionId) throw void 0;
      sessionIdCache = sessionId;
      return sessionId;
  } catch (e) {}

  const sessionId = firstAid.getRandomUuid();
  sessionIdCache = sessionId;
  try {
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
  } finally {
      return sessionId;
  }
};

class SimpleBroadcastChannel extends EventTarget {
  constructor(channelName) {
    super();

    if ('string' != typeof channelName) {
      throw new TypeError('Invalid channel name');
    }

    this.channelName = String(channelName).trim().toLowerCase();
    if (!this.channelName) {
      throw new TypeError('Empty channel name');
    }

    window.addEventListener('storage', ev => {
      if (null === ev.key) {
        console.log('The storage was cleared');
        return;
      }
      if (STORAGE_KEY_BROADCAST != ev.key) {
        return;
      }
      if (!ev.newValue) {
        return;
      }

      const {channelName, data} = JSON.parse(ev.newValue);
      if (channelName != this.channelName) {
        return;
      }
      const messageEvent = new MessageEvent('message', {
        data,
        origin: document.origin,
      });
      this.dispatchEvent(messageEvent);
    });
  }

  postMessage(data) {
    const value = JSON.stringify({
      channelName: this.channelName,
      data,
    });

    try {
      localStorage.setItem(STORAGE_KEY_BROADCAST, value);
    } finally {
      const {data} = JSON.parse(value);
      const messageEvent = new MessageEvent('message', {
        data,
        origin: document.origin,
      });
      this.dispatchEvent(messageEvent);
    }
  }
}

const simpBroadcastChannel = new SimpleBroadcastChannel("eternity.broadcast.simple");
class CompatBroadcastChannel extends EventTarget {
  constructor(channelName) {
    super();

    if ('string' != typeof channelName) {
      throw new TypeError('Invalid channel name');
    }

    this.channelName = String(channelName).trim().toLowerCase();
    if (!this.channelName) {
      throw new TypeError('Empty channel name');
    }

    simpBroadcastChannel.addEventListener("message", (ev) => {
      const {data} = ev;
      if (data.channelName != this.channelName) {
        return;
      }
      const messageEvent = new MessageEvent('message', {
        data: data.data,
        origin: document.origin,
      });
      this.dispatchEvent(messageEvent);
    });
  }

  postMessage(data) {
    simpBroadcastChannel.postMessage({
      channelName: this.channelName,
      data: data,
    });
  }
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Roughly `HTMLElement`.
 */
export class HtmlView {
  /**
   * 
   * @param {string} aText 
   * @returns {HtmlText}
   */
  static text(aText) {
    return new HtmlText(aText);
  }

  static customTag(aTagName, aAttributes, aContent) {
    return new HtmlView(aTagName, aAttributes, aContent);
  }

  static a(aAttributes, aContent) {
    return new HtmlView('a', aAttributes, aContent);
  }

  static abbr(aAttributes, aContent) {
    return new HtmlView('abbr', aAttributes, aContent);
  }

  static address(aAttributes, aContent) {
    return new HtmlView('address', aAttributes, aContent);
  }

  static area(aAttributes) {
    return new HtmlView('area', aAttributes);
  }

  static article(aAttributes, aContent) {
    return new HtmlView('article', aAttributes, aContent);
  }

  static aside(aAttributes, aContent) {
    return new HtmlView('aside', aAttributes, aContent);
  }

  static audio(aAttributes, aContent) {
    return new HtmlView('audio', aAttributes, aContent);
  }

  static b(aAttributes, aContent) {
    return new HtmlView('b', aAttributes, aContent);
  }

  static base(aAttributes) {
    return new HtmlView('base', aAttributes);
  }

  static bdi(aAttributes, aContent) {
    return new HtmlView('bdi', aAttributes, aContent);
  }

  static bdo(aAttributes, aContent) {
    return new HtmlView('bdo', aAttributes, aContent);
  }

  static blockquote(aAttributes, aContent) {
    return new HtmlView('blockquote', aAttributes, aContent);
  }

  static body(aAttributes, aContent) {
    return new HtmlView('body', aAttributes, aContent);
  }

  static br(aAttributes) {
    return new HtmlView('br', aAttributes);
  }

  static button(aAttributes, aContent) {
    return new HtmlView('button', aAttributes, aContent);
  }

  static canvas(aAttributes, aContent) {
    return new HtmlView('canvas', aAttributes, aContent);
  }

  static caption(aAttributes, aContent) {
    return new HtmlView('caption', aAttributes, aContent);
  }

  static cite(aAttributes, aContent) {
    return new HtmlView('cite', aAttributes, aContent);
  }

  static code(aAttributes, aContent) {
    return new HtmlView('code', aAttributes, aContent);
  }

  static col(aAttributes) {
    return new HtmlView('col', aAttributes);
  }

  static colgroup(aAttributes, aContent) {
    return new HtmlView('colgroup', aAttributes, aContent);
  }

  static command(aAttributes, aContent) {
    return new HtmlView('command', aAttributes, aContent);
  }

  static datalist(aAttributes, aContent) {
    return new HtmlView('datalist', aAttributes, aContent);
  }

  static dd(aAttributes, aContent) {
    return new HtmlView('dd', aAttributes, aContent);
  }

  static del(aAttributes, aContent) {
    return new HtmlView('del', aAttributes, aContent);
  }

  static details(aAttributes, aContent) {
    return new HtmlView('details', aAttributes, aContent);
  }

  static dfn(aAttributes, aContent) {
    return new HtmlView('dfn', aAttributes, aContent);
  }

  static dialog(aAttributes, aContent) {
    return new HtmlView('dialog', aAttributes, aContent);
  }

  static div(aAttributes, aContent) {
    return new HtmlView('div', aAttributes, aContent);
  }

  static dl(aAttributes, aContent) {
    return new HtmlView('dl', aAttributes, aContent);
  }

  static dt(aAttributes, aContent) {
    return new HtmlView('dt', aAttributes, aContent);
  }

  static em(aAttributes, aContent) {
    return new HtmlView('em', aAttributes, aContent);
  }

  static embed(aAttributes) {
    return new HtmlView('embed', aAttributes);
  }

  static fieldset(aAttributes, aContent) {
    return new HtmlView('fieldset', aAttributes, aContent);
  }

  static figcaption(aAttributes, aContent) {
    return new HtmlView('figcaption', aAttributes, aContent);
  }

  static figure(aAttributes, aContent) {
    return new HtmlView('figure', aAttributes, aContent);
  }

  static footer(aAttributes, aContent) {
    return new HtmlView('footer', aAttributes, aContent);
  }

  static form(aAttributes, aContent) {
    return new HtmlView('form', aAttributes, aContent);
  }

  static h1(aAttributes, aContent) {
    return new HtmlView('h1', aAttributes, aContent);
  }

  static h2(aAttributes, aContent) {
    return new HtmlView('h2', aAttributes, aContent);
  }

  static h3(aAttributes, aContent) {
    return new HtmlView('h3', aAttributes, aContent);
  }

  static h4(aAttributes, aContent) {
    return new HtmlView('h4', aAttributes, aContent);
  }

  static h5(aAttributes, aContent) {
    return new HtmlView('h5', aAttributes, aContent);
  }

  static h6(aAttributes, aContent) {
    return new HtmlView('h6', aAttributes, aContent);
  }

  static head(aAttributes, aContent) {
    return new HtmlView('head', aAttributes, aContent);
  }

  static header(aAttributes, aContent) {
    return new HtmlView('header', aAttributes, aContent);
  }

  static hr(aAttributes) {
    return new HtmlView('hr', aAttributes);
  }

  static html(aAttributes, aContent) {
    return new HtmlView('html', aAttributes, aContent);
  }

  static i(aAttributes, aContent) {
    return new HtmlView('i', aAttributes, aContent);
  }

  static iframe(aAttributes, aContent) {
    return new HtmlView('iframe', aAttributes, aContent);
  }

  static img(aAttributes) {
    return new HtmlView('img', aAttributes);
  }

  static input(aAttributes) {
    return new HtmlView('input', aAttributes);
  }

  static ins(aAttributes, aContent) {
    return new HtmlView('ins', aAttributes, aContent);
  }

  static kbd(aAttributes, aContent) {
    return new HtmlView('kbd', aAttributes, aContent);
  }

  static label(aAttributes, aContent) {
    return new HtmlView('label', aAttributes, aContent);
  }

  static legend(aAttributes, aContent) {
    return new HtmlView('legend', aAttributes, aContent);
  }

  static li(aAttributes, aContent) {
    return new HtmlView('li', aAttributes, aContent);
  }

  static link(aAttributes) {
    return new HtmlView('link', aAttributes);
  }

  static main(aAttributes, aContent) {
    return new HtmlView('main', aAttributes, aContent);
  }

  static map(aAttributes, aContent) {
    return new HtmlView('map', aAttributes, aContent);
  }

  static mark(aAttributes, aContent) {
    return new HtmlView('mark', aAttributes, aContent);
  }

  static menu(aAttributes, aContent) {
    return new HtmlView('menu', aAttributes, aContent);
  }

  static menuitem(aAttributes, aContent) {
    return new HtmlView('menuitem', aAttributes, aContent);
  }

  static meta(aAttributes) {
    return new HtmlView('meta', aAttributes);
  }

  static meter(aAttributes, aContent) {
    return new HtmlView('meter', aAttributes, aContent);
  }

  static nav(aAttributes, aContent) {
    return new HtmlView('nav', aAttributes, aContent);
  }

  static noscript(aAttributes, aContent) {
    return new HtmlView('noscript', aAttributes, aContent);
  }

  static object(aAttributes, aContent) {
    return new HtmlView('object', aAttributes, aContent);
  }

  static ol(aAttributes, aContent) {
    return new HtmlView('ol', aAttributes, aContent);
  }

  static optgroup(aAttributes, aContent) {
    return new HtmlView('optgroup', aAttributes, aContent);
  }

  static option(aAttributes, aContent) {
    return new HtmlView('option', aAttributes, aContent);
  }

  static output(aAttributes, aContent) {
    return new HtmlView('output', aAttributes, aContent);
  }

  static p(aAttributes, aContent) {
    return new HtmlView('p', aAttributes, aContent);
  }

  static param(aAttributes) {
    return new HtmlView('param', aAttributes);
  }

  static pre(aAttributes, aContent) {
    return new HtmlView('pre', aAttributes, aContent);
  }

  static progress(aAttributes, aContent) {
    return new HtmlView('progress', aAttributes, aContent);
  }

  static q(aAttributes, aContent) {
    return new HtmlView('q', aAttributes, aContent);
  }

  static rp(aAttributes, aContent) {
    return new HtmlView('rp', aAttributes, aContent);
  }

  static rt(aAttributes, aContent) {
    return new HtmlView('rt', aAttributes, aContent);
  }

  static ruby(aAttributes, aContent) {
    return new HtmlView('ruby', aAttributes, aContent);
  }

  static samp(aAttributes, aContent) {
    return new HtmlView('samp', aAttributes, aContent);
  }

  static script(aAttributes, aContent) {
    return new HtmlView('script', aAttributes, aContent);
  }

  static section(aAttributes, aContent) {
    return new HtmlView('section', aAttributes, aContent);
  }

  static select(aAttributes, aContent) {
    return new HtmlView('select', aAttributes, aContent);
  }

  static small(aAttributes, aContent) {
    return new HtmlView('small', aAttributes, aContent);
  }

  static source(aAttributes) {
    return new HtmlView('source', aAttributes);
  }

  static span(aAttributes, aContent) {
    return new HtmlView('span', aAttributes, aContent);
  }

  static strong(aAttributes, aContent) {
    return new HtmlView('strong', aAttributes, aContent);
  }

  static style(aAttributes, aContent) {
    return new HtmlView('style', aAttributes, aContent);
  }

  static sub(aAttributes, aContent) {
    return new HtmlView('sub', aAttributes, aContent);
  }

  static summary(aAttributes, aContent) {
    return new HtmlView('summary', aAttributes, aContent);
  }

  static sup(aAttributes, aContent) {
    return new HtmlView('sup', aAttributes, aContent);
  }

  static table(aAttributes, aContent) {
    return new HtmlView('table', aAttributes, aContent);
  }

  static tbody(aAttributes, aContent) {
    return new HtmlView('tbody', aAttributes, aContent);
  }

  static td(aAttributes, aContent) {
    return new HtmlView('td', aAttributes, aContent);
  }

  static textarea(aAttributes, aContent) {
    return new HtmlView('textarea', aAttributes, aContent);
  }

  static tfoot(aAttributes, aContent) {
    return new HtmlView('tfoot', aAttributes, aContent);
  }

  static th(aAttributes, aContent) {
    return new HtmlView('th', aAttributes, aContent);
  }

  static thead(aAttributes, aContent) {
    return new HtmlView('thead', aAttributes, aContent);
  }

  static time(aAttributes, aContent) {
    return new HtmlView('time', aAttributes, aContent);
  }

  static title(aAttributes, aContent) {
    return new HtmlView('title', aAttributes, aContent);
  }

  static tr(aAttributes, aContent) {
    return new HtmlView('tr', aAttributes, aContent);
  }

  static track(aAttributes) {
    return new HtmlView('track', aAttributes);
  }

  static u(aAttributes, aContent) {
    return new HtmlView('u', aAttributes, aContent);
  }

  static ul(aAttributes, aContent) {
    return new HtmlView('ul', aAttributes, aContent);
  }

  static var(aAttributes, aContent) {
    return new HtmlView('var', aAttributes, aContent);
  }

  static video(aAttributes, aContent) {
    return new HtmlView('video', aAttributes, aContent);
  }

  static wbr(aAttributes) {
    return new HtmlView('wbr', aAttributes);
  }

  #tagName;
  #properties = {};
  #styles = {};
  #eventListeners = {};
  #content = [];
  #key = '';
  #dataset = {};
  #classSet = new Set;

  constructor(tagName, aAttributes, aContent) {
    this.#tagName = String(tagName).toLowerCase(); // SVG and MathML tags are not supported in this view.
    const attributes = [... (aAttributes || [])];
    const content = VOID_ELEMENTS.has(this.#tagName) ? [] : [... (aContent || [])];
    for (const view of content) {
      if (!(view instanceof HtmlView)) {
        throw new TypeError('Not an HtmlView');
      }
      this.#content.push(view);
    }
    for (const attribute of attributes) {
      if (attribute instanceof ViewAttribute) {
        this.#properties[attribute.property] = attribute.value;
      } else if (attribute instanceof ViewStyle) {
        this.#styles[attribute.property] = attribute.value;
      } else if (attribute instanceof ViewEventListener) {
        this.#eventListeners[attribute.eventName] = attribute.listener;
      } else if (attribute instanceof ViewData) {
        this.#dataset[attribute.property] = attribute.value;
      } else if (attribute instanceof ViewClassSet) {
        for (const className of attribute) {
          this.#classSet.add(className);
        }
      } else if (attribute instanceof ViewKey) {
        this.#key = attribute.key;
      } else {
        throw new TypeError('Invalid ViewAttribute');
      }
    }
  }

  /**
   * @returns {string}
   */
  get tagName() {
    return this.#tagName;
  }

  /**
   * @returns {[HtmlView]}
   */
  get content() {
    return [... this.#content];
  }

  /**
   * @returns {{[property: string]: string}}
   */
  get attributes() {
    const properties = {};
    for (const prop of Object.getOwnPropertyNames(this.#properties).sort()) {
      properties[prop] = String(this.#properties[prop]);
    }
    return properties;
  }

  /**
   * @returns {{[property: string]: string}}
   */
  get styles() {
    const styles = {};
    for (const prop of Object.getOwnPropertyNames(this.#styles).sort()) {
      styles[prop] = String(this.#styles[prop]);
    }
    return styles;
  }

  /**
   * @returns {{[eventName: string]: function}}
   */
  get eventListeners() {
    return {... this.#eventListeners};
  }

  /**
   * @returns {{[property: string]: string}}
   */
  get dataset() {
    return {... this.#dataset};
  }

  /**
   * @returns {[string]}
   */
  get classes() {
    return [... this.#classSet];
  }

  /**
   * @returns {string}
   */
  get key() {
    return this.#key;
  }
}

export class HtmlText extends HtmlView {
  #text;

  constructor(aText) {
    super('#text', [], []);
    this.#text = String(aText);
  }

  get text() {
    return this.#text;
  }
}

export class ViewProperty {
  static key(aKey) {
    return new ViewKey(aKey);
  }

  static style(aProperty, aValue) {
    return new ViewStyle(aProperty, aValue);
  }

  static data(aProperty, aValue) {
    return new ViewData(aProperty, aValue);
  }

  static classes(aClasses) {
    return new ViewClassSet(aClasses);
  }

  static attribute(aProp, aValue) {
    return new ViewAttribute(aProp, aValue);
  }

  static eventListener(aEventName, aListener) {
    return new ViewEventListener(aEventName, aListener);
  }
}

export class ViewKey extends ViewProperty {
  #key;

  constructor(aKey) {
    super();
    this.#key = String(aKey);
    if ('' === this.#key) {
      throw new TypeError('Key cannot be empty');
    }
  }

  get key() {
    return this.#key;
  }
}

export class ViewAttribute extends ViewProperty {
  static id(aId) {
    return new ViewAttribute('id', aId);
  }

  #property;
  #value;

  constructor(aProperty, aValue) {
    super();
    this.#property = String(aProperty);
    this.#value = String(aValue);
  }

  /**
   * @returns {string}
   */
  get property() {
    return this.#property;
  }

  /**
   * @returns {string}
   */
  get value() {
    return this.#value;
  }
}

export class ViewData extends ViewProperty {
  #property;
  #value;

  constructor(aProperty, aValue) {
    super();
    this.#property = String(aProperty);
    this.#value = String(aValue);
  }

  /**
   * @returns {string}
   */
  get property() {
    return this.#property;
  }

  /**
   * @returns {string}
   */
  get value() {
    return this.#value;
  }
}

export class ViewStyle extends ViewProperty {
  #property;
  #value;

  constructor(aProperty, aValue) {
    super();
    this.#property = String(aProperty);
    this.#value = String(aValue);
  }

  /**
   * @returns {string}
   */
  get property() {
    return this.#property;
  }

  /**
   * @returns {string}
   */
  get value() {
    return this.#value;
  }
}

export class ViewClassSet extends ViewProperty {
  #classSet;

  constructor(aClasses) {
    super();
    this.#classSet = new Set([... (aClasses || [])].map((className) => String(className)).sort());
  }

  *[Symbol.iterator]() {
    for (const className of this.#classSet) {
      yield className;
    }
  }
}

export class ViewEventListener extends ViewProperty {
  #eventName;
  #listener;

  constructor(aEventName, aListener) {
    super();
    if ('function' != typeof aListener) {
      throw new TypeError('listener must be a function');
    }
    this.#eventName = String(aEventName);
    this.#listener = aListener;
  }

  /**
   * @returns {string}
   */
  get eventName() {
    return this.#eventName;
  }

  /**
   * @returns {function}
   */
  get listener() {
    return this.#listener;
  }
}

/**
 * @type {WeakMap<HTMLElement, {[eventName: string]: ViewEventListener}}
 */
const registeredEventListeners = new WeakMap;

/**
 * @type {WeakMap<HTMLElement, string>}
 */
const keyMap = new WeakMap;

const render = (element, aViews) => {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('Not an HTMLElement');
  }
  const views = [... aViews];
  const nodes = [... element.childNodes];
  let nodeIndex = 0;
  let prevNode = null;
  for (const view of views) {
    if (!(view instanceof HtmlView)) {
      throw new TypeError('Not an HtmlView');
    }
    let found = false;
    let foundIndex = -1;
    for (let i = nodeIndex; i < nodes.length; i++) {
      const node = nodes[i];
      const nodeKey = keyMap.get(node) || '';
      if (node.nodeName.toLowerCase() == view.tagName && nodeKey == view.key) {
        found = true;
        foundIndex = i;
        prevNode = node;
        //console.log('Found at %d: searched from index %d, tagName: %s, key: %s', i, nodeIndex, view.tagName, view.key);
        if (node.nodeName == '#text' && view instanceof HtmlText) {
          node.textContent = view.text;
        } else if (node instanceof HTMLElement) {
          const eventListeners = registeredEventListeners.get(node);
          if (eventListeners) {
            for (const eventName of Object.getOwnPropertyNames(eventListeners)) {
              try {
                node.removeEventListener(eventName, eventListeners[eventName]);
              } catch (e) {}
            }
          }
          const attributes = view.attributes;
          for (const attribute of node.attributes) {
            if (!(attribute.name in attributes)) {
              node.removeAttributeNode(attribute);
            }
          }
          for (const attr of Object.getOwnPropertyNames(attributes)) {
            node.setAttribute(attr, attributes[attr]);
          }
          const classes = view.classes;
          for (const className of node.classList) {
            if (!classes.includes(className)) {
              node.classList.remove(className);
            }
          }
          for (const className of classes) {
            node.classList.add(className);
          }
          const dataset = view.dataset;
          for (const prop in node.dataset) {
            if (!(prop in dataset)) {
              delete node.dataset[prop];
            }
          }
          for (const prop of Object.getOwnPropertyNames(dataset)) {
            node.dataset[prop] = dataset[prop];
          }
          const newEventListeners = view.eventListeners;
          for (const eventName of Object.getOwnPropertyNames(newEventListeners)) {
            node.addEventListener(eventName, newEventListeners[eventName]);
          }
          registeredEventListeners.set(node, newEventListeners);
          const newStyle = view.styles;
          for (const prop of node.style) {
            if (!(prop in newStyle)) {
              node.style.removeProperty(prop);
            }
          }
          for (const prop of Object.getOwnPropertyNames(newStyle)) {
            node.style.setProperty(prop, newStyle[prop]);
          }
          render(node, view.content);
        }
        break;
      }
    }
    if (found) {
      let removedNodes = 0;
      for (let i = nodeIndex; i < foundIndex; i++) {
        element.removeChild(nodes[i]);
        removedNodes++;
      }
      //console.log('Removed %d nodes from index: %d', removedNodes, nodeIndex);
      nodeIndex = foundIndex + 1;
    } else {
      let newNode;
      if (view instanceof HtmlText) {
        newNode = document.createTextNode(view.text);
      } else {
        newNode = document.createElement(view.tagName);
        const attributes = view.attributes;
        for (const attr of Object.getOwnPropertyNames(attributes)) {
          newNode.setAttribute(attr, attributes[attr]);
        }
        const classes = view.classes;
        for (const className of classes) {
          newNode.classList.add(className);
        }
        const dataset = view.dataset;
        for (const prop of Object.getOwnPropertyNames(dataset)) {
          newNode.dataset[prop] = dataset[prop];
        }
        if (view.key) {
          keyMap.set(newNode, view.key);
        }
      }
      if (prevNode instanceof Node) {
        if (prevNode.nextSibling instanceof Node) {
          element.insertBefore(newNode, prevNode.nextSibling)
        } else {
          element.appendChild(newNode);
        }
      } else if (element.firstChild instanceof Node) {
        element.insertBefore(newNode, element.firstChild);
      } else {
        element.appendChild(newNode);
      }
      prevNode = newNode;
      //console.log('Inserted: tagName: %s, key: %s', view.tagName, view.key);
      if (newNode instanceof HTMLElement) {
        const newStyle = view.styles;
        for (const prop of Object.getOwnPropertyNames(newStyle)) {
          newNode.style.setProperty(prop, newStyle[prop]);
        }
        const newEventListeners = view.eventListeners;
        for (const eventName of Object.getOwnPropertyNames(newEventListeners)) {
          newNode.addEventListener(eventName, newEventListeners[eventName]);
        }
        registeredEventListeners.set(newNode, newEventListeners);
        render(newNode, view.content);
      }
    }
  }
  if (prevNode instanceof Node) {
    let nextNode = prevNode.nextSibling;
    let removedNodes = 0;
    while (nextNode instanceof Node) {
      const node = nextNode;
      nextNode = nextNode.nextSibling;
      element.removeChild(node);
      removedNodes++;
    }
    //console.log('Removed %d nodes at the end', removedNodes);
  } else if (views.length < 1) {
    for (const node of element.childNodes) {
      element.removeChild(node);
    }
  }
};

class Store {
  #storageKey;
  #stateCache;
  #observers = new Set;
  #topicListeners = {};

  constructor(app, name, initializer) {
    if ('' === name || 'string' != typeof name) {
      throw new TypeError('Invalid Store name');
    }
    if ('function' != typeof initializer) {
      throw new TypeError('Initializer must be a function');
    }
    this.#storageKey = `${STORAGE_KEY_PREFIX_STATE}.${name}`;
    this.#stateCache = '{}';
    const newState = initializer(this.state);
    const json = JSON.stringify(newState) || this.#stateCache;
    this.#stateCache = json;
    try {
      sessionStorage.setItem(this.#storageKey, json);
    } catch (e) {
      console.error('Error writing sessionStorage:', e);
    }
  }

  get state() {
    try {
      const json = sessionStorage.getItem(this.#storageKey) || this.#stateCache;
      const state = JSON.parse(json);
      this.#stateCache = JSON.stringify(state);
      return state;
    } catch (e) {
      console.error('Error reading sessionStorage:', e);
      return JSON.parse(this.#stateCache);
    }
  }

  subscribe(topic, reducer) {
    if (!(topic instanceof Topic)) {
      throw new TypeError('Invalid Topic object');
    }
    if ('function' != typeof reducer) {
      throw new TypeError('Reducer must be a function');
    }
    const topicKey = String(topic);
    if (topicKey in this.#topicListeners) {
      try {
        topic.removeListener(this.#topicListeners[topicKey]);
      } catch (e) {}
    }
    const listener = this.#topicListeners[topicKey] = (action) => {
      try {
        const newState = reducer(this.state, action);
        const json = JSON.stringify(newState) || this.#stateCache;
        this.#stateCache = json;
        try {
          sessionStorage.setItem(this.#storageKey, json);
        } catch (e) {
          console.error('Error writing sessionStorage:', e);
        }
        for (const observer of this.#observers) {
          callMaybeAsyncIgnoringError(observer, this.state);
        }
      } catch (e) {
        console.error('Error calling reducer:', e);
      }
    };
    topic.addListener(listener);
  }

  unsubscribe(topic) {
    if (!(topic instanceof Topic)) {
      throw new TypeError('Invalid Topic object');
    }
    const topicKey = String(topic);
    if (topicKey in this.#topicListeners) {
      try {
        const listener = this.#topicListeners[topicKey];
        delete this.#topicListeners[topicKey];
        topic.removeListener(listener);
      } catch (e) {}
    }
  }

  observe(observer) {
    if ('function' != typeof observer) {
      throw new TypeError('Observer must be a function');
    }
    this.#observers.add(observer);
    callMaybeAsyncIgnoringError(observer, this.state);
  }

  unobserve(observer) {
    if ('function' != typeof observer) {
      throw new TypeError('Observer must be a function');
    }
    this.#observers.delete(observer);
  }

  /**
   * 
   * @param {HTMLElement} element 
   * @param {(state: any) => (HtmlView | [HtmlView])} renderer 
   */
  render(element, renderer) {
    if (!(element instanceof HTMLElement)) {
      throw new TypeError('Not an HTMLElement');
    }
    if ('function' != typeof renderer) {
      throw new TypeError('Renderer must be a function');
    }

    this.observe((state) => {
      const result = renderer(state);
      const views = result instanceof HtmlView ? [result] : [... result];
      render(element, views);
    });
  }

  get [Symbol.toStringTag]() {
    return 'Store';
  }
}

class Topic {
  #scope;
  #name;
  #broadcastChannel;
  #listenerMap = new WeakMap;
  #channelName;

  constructor(app, scope, name) {
    if (!(app instanceof Eternity)) {
      throw new TypeError('Invalid app object');
    }
    if (!TOPIC_SCOPES.has(scope)) {
      throw new TypeError('Invalid scope');
    }
    if ('' === name || 'string' != typeof name) {
      throw new TypeError('Invalid topic name');
    }
    this.#scope = scope;
    this.#name = name;
    let channelName
    switch(scope) {
      case TOPIC_SCOPE_CLIENT: {
        channelName =`topic.client.${app.clientId}.${name}`;
        break;
      }
      case TOPIC_SCOPE_SESSION: {
        channelName = `topic.session.${app.sessionId}.${name}`;
        break;
      }
      case TOPIC_SCOPE_INSTANCE: {
        channelName = `topic.instance.${app.instanceId}.${name}`;
        break;
      }
      default: {
        throw 'This should not happen';
      }
    }
    this.#channelName = channelName;
    this.#broadcastChannel = new CompatBroadcastChannel(channelName);
  }

  get scope() {
    return this.#scope;
  }

  get name() {
    return this.#name;
  }

  dispatch(action) {
    this.#broadcastChannel.postMessage(action);
  }

  addListener(listener) {
    if ('function' != typeof listener) {
      throw new TypeError('Listener must be a function');
    }
    const eventHandler = (ev) => {
      callMaybeAsyncIgnoringError(listener, ev.data);
    };
    this.#listenerMap.set(listener, eventHandler);
    this.#broadcastChannel.addEventListener('message', eventHandler);
  }

  removeListener(listener) {
    if ('function' != typeof listener) {
      throw new TypeError('Listener must be a function');
    }
    const eventHandler = this.#listenerMap.get(listener);
    if (!eventHandler) {
      try {
        this.#broadcastChannel.removeEventListener('message', eventHandler);
      } catch (e) {}
    }
  }

  toString() {
    return `Topic(${this.#channelName})`;
  }
}

export class Eternity {
  #instanceId;
  #sessionId;
  #clientId;

  static get TOPIC_SCOPE_CLIENT() {
    return TOPIC_SCOPE_CLIENT;
  }

  static get TOPIC_SCOPE_SESSION() {
    return TOPIC_SCOPE_SESSION;
  }

  static get TOPIC_SCOPE_INSTANCE() {
    return TOPIC_SCOPE_INSTANCE;
  }

  constructor() {
    this.#instanceId = firstAid.getRandomUuid();
    this.#sessionId = getSessionId();
    this.#clientId = getClientId();
  }

  get clientId() {
    return this.#clientId;
  }

  get sessionId() {
    return this.#sessionId;
  }

  get instanceId() {
    return this.#instanceId;
  }

  getStore(name, initializer) {
    return new Store(this, name, initializer);
  }

  getTopic(scope, name) {
    return new Topic(this, scope, name);
  }

  get [Symbol.toStringTag]() {
    return 'Eternity';
  }
}

export class LocalStorageData {
  #key;
  #data;
  #observers = new Set;

  constructor(aKey, aInitializer) {
    if ('function' != typeof aInitializer) {
      throw new TypeError('Initializer must be a function');
    }
    this.#key = String(aKey);
    let json;
    try {
      json = localStorage.getItem(this.#key);
      if (!json) {
        json = JSON.stringify(aInitializer());
        localStorage.setItem(this.#key, json);
      }
      this.#data = json;
    } catch (e) {
      console.error(e);
      this.#data = JSON.stringify(aInitializer());
    }
    window.addEventListener('storage', (ev) => {
      //
      if (ev.key != this.#key) {
        return;
      }
      if (localStorage != ev.storageArea) {
        return;
      }
      const newValue = ev.newValue;
      if (null == newValue) {
        return;
      }
      try {
        JSON.parse(newValue); // test if throws
        this.#data = newValue;
        for (const observer of this.#observers) {
          callMaybeAsyncIgnoringError(observer, this.getValue());
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  getValue() {
    try {
      const json = localStorage.getItem(this.#key);
      const data = JSON.parse(json);
      this.#data = json;
      return data;
    } catch (e) {
      try {
        localStorage.setItem(this.#key, this.#data);
      } catch (e) {}
      const data = JSON.parse(this.#data);
      return data;
    }
  }

  setValue(aValue) {
    const json = JSON.stringify(aValue);
    this.#data = json;
    try {
      localStorage.setItem(this.#key, json);
    } catch (e) {
      console.error(e);
    }
    for (const observer of this.#observers) {
      callMaybeAsyncIgnoringError(observer, this.getValue());
    }
  }

  observe(aObserver) {
    if ('function' != typeof aObserver) {
      throw new TypeError('Observer must be a function');
    }
    this.#observers.add(aObserver);
    callMaybeAsyncIgnoringError(aObserver, this.getValue());
  }

  unobserve(aObserver) {
    if ('function' != typeof aObserver) {
      throw new TypeError('Observer must be a function');
    }
    this.#observers.delete(aObserver);
  }

  get key() {
    return this.#key;
  }
}
