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

/**
 * 
 */
interface Store {
  readonly state: any;
  subscribe(topic: Topic, reducer: (state: any, action: any) => any): void;
  unsubscribe(topic: Topic): void;
  observe(observer: (state: any) => void): void;
  unobserve(observer: (state: any) => void): void;
  render(element: HTMLElement, renderer: (state: any) => ([HtmlView] | HtmlView)): void;
}

interface Topic {
  readonly scope: TopicScope;
  readonly name: string;
  dispatch(action: any): void;
  addListener(listener: (action: any) => void): void;
  removeListener(listener: (action: any) => void): void;
}

type TopicScope = 'client' | 'session' | 'instance';

export class HtmlView {
  static text(aText: string): HtmlText;

  static customTag(aTagName: string, aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static a(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static abbr(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static address(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static area(aAttriibutes: [ViewProperty]): HtmlView;

  static article(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static aside(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static audio(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static b(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static base(aAttriibutes: [ViewProperty]): HtmlView;

  static bdi(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static bdo(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static blockquote(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static body(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static br(aAttriibutes: [ViewProperty]): HtmlView;

  static button(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static canvas(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static caption(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static cite(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static code(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static col(aAttriibutes: [ViewProperty]): HtmlView;

  static colgroup(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static command(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static datalist(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static dd(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static del(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static details(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static dfn(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static dialog(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static div(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static dl(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static dt(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static em(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static embed(aAttriibutes: [ViewProperty]): HtmlView;

  static fieldset(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static figcaption(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static figure(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static footer(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static form(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h1(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h2(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h3(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h4(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h5(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static h6(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static head(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static header(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static hr(aAttriibutes: [ViewProperty]): HtmlView;

  static html(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static i(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static iframe(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static img(aAttriibutes: [ViewProperty]): HtmlView;

  static input(aAttriibutes: [ViewProperty]): HtmlView;

  static ins(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static kbd(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static label(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static legend(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static li(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static link(aAttriibutes: [ViewProperty]): HtmlView;

  static main(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static map(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static mark(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static menu(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static menuitem(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static meta(aAttriibutes: [ViewProperty]): HtmlView;

  static meter(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static nav(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static noscript(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static object(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static ol(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static optgroup(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static option(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static output(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static p(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static param(aAttriibutes: [ViewProperty]): HtmlView;

  static pre(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static progress(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static q(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static rp(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static rt(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static ruby(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static samp(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static script(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static section(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static select(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static small(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static source(aAttriibutes: [ViewProperty]): HtmlView;

  static span(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static strong(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static style(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static sub(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static summary(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static sup(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static table(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static tbody(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static td(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static textarea(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static tfoot(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static th(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static thead(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static time(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static title(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static tr(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static track(aAttriibutes: [ViewProperty]): HtmlView;

  static u(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static ul(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static var(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static video(aAttriibutes: [ViewProperty], aContent: [HtmlView]): HtmlView;

  static wbr(aAttriibutes: [ViewProperty]): HtmlView;

  readonly tagName: string;
  readonly content: [HtmlView];
  readonly properties: {[property: string]: string};
  readonly styles: {[property: string]: string};
  readonly eventListeners: {[eventName: string]: Function};
  readonly dataset: {[property: string]: string};
  readonly classes: [string];
  readonly key: string;
}

export class HtmlText extends HtmlView {
  readonly text: string;
}

export class ViewProperty {
  static key(aKey: string): ViewKey;
  static style(aProperty: string, aValue: string): ViewStyle;
  static data(aProperty: string, aValue: string): ViewData;
  static classes(aClasses: Iterable<string>): ViewClassSet;
  static attribute(aProperty: string, aValue: string): ViewAttribute;
  static eventListener(aEventName: string, aListener: Function): ViewEventListener;
}

export class ViewKey extends ViewProperty {
  readonly key: string;
}

export class ViewAttribute extends ViewProperty {
  static id(aId: string): ViewAttribute;

  readonly property: string;
  readonly value: string;
}

export class ViewData extends ViewProperty {
  readonly property: string;
  readonly value: string;
}

export class ViewClassSet extends ViewProperty {
  [Symbol.iterator](): Iterator<string>;
}

export class ViewStyle extends ViewProperty {
  readonly property: string;
  readonly value: string;
}

export class ViewEventListener extends ViewProperty {
  readonly eventName: string;
  readonly listener: Function;
}

export class Eternity {
  static readonly TOPIC_SCOPE_CLIENT: 'client';
  static readonly TOPIC_SCOPE_SESSION: 'session';
  static readonly TOPIC_SCOPE_INSTANCE: 'instance';

  readonly clientId: string;
  readonly sessionId: string;
  readonly instanceId: string;

  getStore(name: string, initializer: (state: any) => any): Store;
  getTopic(scope: TopicScope, name: string): Topic;
}

export class LocalStorageData<T> {
  readonly key: string;

  constructor(aKey: string, aInitializer: () => T);
  getValue(): T;
  setValue(aValue: T): void;
  observe(aObserver: (value: T) => void): void;
  unobserve(aObserver: (value: T) => void): void;
}
