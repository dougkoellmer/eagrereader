// Copyright (C) 2008-2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview
 * A partially tamed browser object model based on
 * <a href="http://www.w3.org/TR/DOM-Level-2-HTML/Overview.html"
 * >DOM-Level-2-HTML</a> and specifically, the
 * <a href="http://www.w3.org/TR/DOM-Level-2-HTML/ecma-script-binding.html"
 * >ECMAScript Language Bindings</a>.
 *
 * Caveats:<ul>
 * <li>Security Review is pending.
 * <li><code>===</code> and <code>!==</code> on node lists will not
 *   behave the same as with untamed node lists.  Specifically, it is
 *   not always true that {@code nodeA.childNodes === nodeA.childNodes}.
 * </ul>
 *
 * <p>
 * TODO(ihab.awad): Our implementation of getAttribute (and friends)
 * is such that standard DOM attributes which we disallow for security
 * reasons (like 'form:enctype') are placed in the "virtual" attributes
 * map (the data-caja-* namespace). They appear to be settable and gettable,
 * but their values are ignored and do not have the expected semantics
 * per the DOM API. This is because we do not have a column in
 * html4-defs.js stating that an attribute is valid but explicitly
 * blacklisted. Alternatives would be to always throw upon access to
 * these attributes; to make them always appear to be null; etc. Revisit
 * this decision if needed.
 *
 * @author mikesamuel@gmail.com (original Domita)
 * @author kpreid@switchb.org (port to ES5)
 * @requires console
 * @requires bridalMaker, cajaVM, cssSchema, lexCss, URI, unicode
 * @requires parseCssDeclarations, sanitizeCssProperty, sanitizeCssSelectors
 * @requires html, html4, htmlSchema
 * @requires WeakMap, Proxy
 * @requires CSS_PROP_BIT_HISTORY_INSENSITIVE
 * @requires HtmlEmitter
 * @provides Domado
 * @overrides window
 */

// The Turkish i seems to be a non-issue, but abort in case it is.
if ('I'.toLowerCase() !== 'i') { throw 'I/i problem'; }

var Domado = (function() {
  'use strict';

  var isVirtualizedElementName = htmlSchema.isVirtualizedElementName;
  var realToVirtualElementName = htmlSchema.realToVirtualElementName;
  var virtualToRealElementName = htmlSchema.virtualToRealElementName;

  var cajaPrefix = 'data-caja-';
  var cajaPrefRe = new RegExp('^' + cajaPrefix);

  // From RFC3986
  var URI_SCHEME_RE = new RegExp(
      '^' +
      '(?:' +
        '([^:\/?# ]+)' +         // scheme
      ':)?'
  );

  var ALLOWED_URI_SCHEMES = /^(?:https?|mailto)$/i;

  /**
   * Tests if the given uri has an allowed scheme.
   * This matches the logic in UriPolicyNanny#apply
   */
  function allowedUriScheme(uri) {
    return (uri.hasScheme() && ALLOWED_URI_SCHEMES.test(uri.getScheme()));
  }

  function ifThrowsThenNull(uri, func) {
    try {
      return func();
    } catch (e) {
      console.log('Rejecting url ' + uri + ' because ' + e);
      return null;
    }
  }

  function uriFetch(naiveUriPolicy, uri, mime, callback) {
    if (!naiveUriPolicy || !callback
      || 'function' !== typeof naiveUriPolicy.fetch) {
      return;
    }
    uri = '' + uri;
    var parsed = URI.parse(uri);
    ifThrowsThenNull(uri, function() {
      if (allowedUriScheme(parsed)) {
        naiveUriPolicy.fetch(parsed, mime, callback);
      } else {
        naiveUriPolicy.fetch(undefined, mime, callback);
      }
    });
  }

  function uriRewrite(naiveUriPolicy, uri, effects, ltype, hints) {
    if (!naiveUriPolicy || 'function' !== typeof naiveUriPolicy.rewrite) {
      return null;
    }
    uri = '' + uri;
    var parsed = URI.parse(uri);
    return ifThrowsThenNull(uri, function() {
      if (allowedUriScheme(parsed)) {
        var safeUri = naiveUriPolicy.rewrite(parsed, effects, ltype, hints);
        return safeUri ? safeUri.toString() : null;
      } else {
        return null;
      }
    });
  }

  var proxiesAvailable = typeof Proxy !== 'undefined';
  var proxiesInterceptNumeric = proxiesAvailable && (function() {
    var handler = {
      toString: function() { return 'proxiesInterceptNumeric test handler'; },
      getOwnPropertyDescriptor: function(name) {
        return {value: name === '1' ? 'ok' : 'other'};
      }
    };
    handler.getPropertyDescriptor = handler.getOwnPropertyDescriptor;
    var proxy = Proxy.create(handler);
    return proxy[1] === 'ok';
  }());

  var canHaveEnumerableAccessors = (function() {
    // Firefox bug causes enumerable accessor properties to appear as own
    // properties of children. SES patches this by prohibiting enumerable
    // accessor properties. We work despite the bug by making all such
    // properties non-enumerable using this flag.
    try {
      Object.defineProperty({}, "foo", {
        enumerable: true,
        configurable: false,
        get: function () {}
      });
      return true;
    } catch (e) {
      return false;
    }
  })();

  function getPropertyDescriptor(o, n) {
    if (o === null || o === undefined) {
      return undefined;
    } else {
      return Object.getOwnPropertyDescriptor(o, n)
          || getPropertyDescriptor(Object.getPrototypeOf(o), n);
    }
  }

  /**
   * This is a simple forwarding proxy handler. Code copied 2011-05-24 from
   * <http://wiki.ecmascript.org/doku.php?id=harmony:proxy_defaulthandler>
   * with modifications to make it work on ES5-not-Harmony-but-with-proxies as
   * provided by Firefox 4.0.1 and to be compatible with SES's WeakMap
   * emulation.
   */
  function ProxyHandler(target) {
    this.target = target;
  };
  ProxyHandler.prototype = {
    constructor: ProxyHandler,

    // == fundamental traps ==

    // Object.getOwnPropertyDescriptor(proxy, name) -> pd | undefined
    getOwnPropertyDescriptor: function(name) {
      var desc = Object.getOwnPropertyDescriptor(this.target, name);
      if (desc !== undefined) { desc.configurable = true; }
      return desc;
    },

    // Object.getPropertyDescriptor(proxy, name) -> pd | undefined
    getPropertyDescriptor: function(name) {
      var desc = Object.getPropertyDescriptor(this.target, name);
      if (desc !== undefined) { desc.configurable = true; }
      return desc;
    },

    // Object.getOwnPropertyNames(proxy) -> [ string ]
    getOwnPropertyNames: function() {
      return Object.getOwnPropertyNames(this.target);
    },

    // Object.getPropertyNames(proxy) -> [ string ]
    getPropertyNames: function() {
      return Object.getPropertyNames(this.target);
    },

    // Object.defineProperty(proxy, name, pd) -> undefined
    defineProperty: function(name, desc) {
      Object.defineProperty(this.target, name, desc);
      return true;
    },

    // delete proxy[name] -> boolean
    'delete': function(name) {
      return delete this.target[name];
    },

    // Object.{freeze|seal|preventExtensions}(proxy) -> proxy
    fix: function() {
      // As long as target is not frozen,
      // the proxy won't allow itself to be fixed
      if (!Object.isFrozen(this.target)) {
        return undefined;
      }
      var props = {};
      for (var name in this.target) {
        props[name] = Object.getOwnPropertyDescriptor(this.target, name);
      }
      return props;
    },

    // == derived traps ==

    // name in proxy -> boolean
    has: function(name) { return name in this.target; },

    // ({}).hasOwnProperty.call(proxy, name) -> boolean
    hasOwn: function(name) {
      return ({}).hasOwnProperty.call(this.target, name);
    },

    // proxy[name] -> any
    get: function(proxy, name) {
      return this.target[name];
    },

    // proxy[name] = value
    set: function(proxy, name, value) {
      this.target[name] = value;
      return true;
    },

    // for (var name in proxy) { ... }
    enumerate: function() {
      var result = [];
      for (var name in this.target) { result.push(name); };
      return result;
    },

    /*
    // if iterators would be supported:
    // for (var name in proxy) { ... }
    iterate: function() {
      var props = this.enumerate();
      var i = 0;
      return {
        next: function() {
          if (i === props.length) throw StopIteration;
          return props[i++];
        }
      };
    },*/

    // Object.keys(proxy) -> [ string ]
    keys: function() { return Object.keys(this.target); }
  };
  cajaVM.def(ProxyHandler);

  function makeOverrideSetter(object, prop) {
    return innocuous(function overrideSetter(newValue) {
      if (object === this) {
        throw new TypeError('Cannot set virtually frozen property: ' + prop);
      }
      if (!!Object.getOwnPropertyDescriptor(this, prop)) {
        this[prop] = newValue;
      }
      // TODO(erights): Do all the inherited property checks
      Object.defineProperty(this, prop, {
        value: newValue,
        writable: true,
        enumerable: true,
        configurable: true
      });
    });
  }

  /**
   * Takes a property descriptor and, if it is a non-writable data property or
   * an accessor with only a getter, returns a replacement descriptor which
   * allows the property to be overridden by assignment.
   *
   * Note that the override behavior is only of value when the object is
   * inherited from, so properties defined on "instances" should not use this as
   * it is unnecessarily expensive.
   */
  function allowNonWritableOverride(object, prop, desc) {
    if (!('value' in desc && !desc.writable)) {
      return desc;
    }
    var value = desc.value;
    // TODO(kpreid): Duplicate of tamperProof() from repairES5.js.
    // We should extract that getter/setter pattern as a separate routine; but
    // note that we need to make the same API available from ES5/3 (though not
    // the same behavior, since ES5/3 rejects the 'override mistake',
    // ASSIGN_CAN_OVERRIDE_FROZEN in repairES5 terms) available from ES5/3.
    return {
      configurable: desc.configurable,
      enumerable: desc.enumerable,
      get: innocuous(function overrideGetter() { return value; }),
      set: makeOverrideSetter(object, prop)
    };
  }

  /**
   * Alias for a common pattern: non-enumerable toString method.
   */
  function setToString(obj, fn) {
    Object.defineProperty(obj, 'toString',
        allowNonWritableOverride(obj, 'toString', {value: fn}));
  }

  /**
   * Shortcut for a single unmodifiable property. No provision for override.
   */
  function setFinal(object, prop, value) {
    Object.defineProperty(object, prop, {
      enumerable: true,
      value: value
    });
  }

  /**
   * Given that n is a string, is n an "array element" property name?
   */
  function isNumericName(n) {
    return ('' + (+n)) === n;
  }

  function inherit(subCtor, superCtor, opt_writableProto) {
    var inheritingProto = Object.create(superCtor.prototype);
    // TODO(kpreid): The following should work but is a no-op on Chrome
    // 24.0.1312.56, which breaks everything. Enable it when possible.
    //Object.defineProperty(subCtor, 'prototype', {
    //  value: inheritingProto,
    //  writable: Boolean(opt_writableProto),
    //  enumerable: false,
    //  configurable: false
    //});
    // Workaround:
    if (opt_writableProto) {
      subCtor.prototype = inheritingProto;
    } else {
      Object.defineProperty(subCtor, 'prototype', {
        enumerable: false,
        value: inheritingProto
      });
    }

    Object.defineProperty(subCtor.prototype, 'constructor', {
      value: subCtor,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }

  /**
   * Checks that a user-supplied callback is a function. Return silently if the
   * callback is valid; throw an exception if it is not valid.
   *
   * TODO(kpreid): Is this conversion to ES5-world OK?
   *
   * @param aCallback some user-supplied "function-like" callback.
   */
  function ensureValidCallback(aCallback) {

    if ('function' !== typeof aCallback) {
      throw new Error('Expected function not ' + typeof aCallback);
    }
  }

  /**
   * This combines trademarks with amplification, and is really a thin wrapper
   * on WeakMap. It allows objects to have an arbitrary collection of private
   * properties, which can only be accessed by those holding the amplifier 'p'
   * (which, in most cases, should be only a particular prototype's methods.)
   *
   * Unlike trademarks, this does not freeze the object. It is assumed that the
   * caller makes the object sufficiently frozen for its purposes and/or that
   * the private properties are all that needs protection.
   *
   * This is designed to be more efficient and straightforward than using both
   * trademarks and per-private-property sealed boxes or weak maps.
   *
   * Capability design note: This facility provides sibling amplification (the
   * ability for one object to access the private state of other similar
   * objects).
   */
  var Confidence = (function () {
    function Confidence(typename) {
      var table = new WeakMap();

      /**
       * Add an object to the confidence. This permits it to pass the
       * guard and provides a private-properties record for it.
       *
       * @param {Object} object The object to add.
       * @param {Object} taming The taming membrane which the object is on the
       *     tame side of.
       * @param {Object} opt_sameAs If provided, an existing object whose
       *     private state will be reused for {@code object}.
       */
      this.confide = cajaVM.constFunc(function(object, taming, opt_sameAs) {
        //console.debug("Confiding:", object);
        if (table.get(object) !== undefined) {
          if (table.get(object)._obj !== object) {
            throw new Error("WeakMap broke! " + object + " vs. " +
                table.get(object)._obj);
          }
          throw new Error(typename + " has already confided in " + object);
        }

        var privates;
        if (opt_sameAs !== undefined) {
          privates = table.get(opt_sameAs);
          if (!privates) {
            throw new Error(typename + ': opt_sameAs not confided');
          }
        } else {
          privates = {_obj: object, _taming: taming};
        }

        table.set(object, privates);
      });

      var guard = this.guard = cajaVM.makeTableGuard(table, typename,
          'This operation requires a ' + typename);

      /**
       * Wrap a method or other function so as to ensure that:
       *   * 'this' is a confidant,
       *   * the first parameter of the original function is the private state,
       *   * the wrapper is frozen,
       *   * and any exceptions thrown from host-side code are wrapped.
       */
      this.amplifying = function(method) {
        if (typeof method !== 'function') {
          throw new Error(typename + ': amplifying(non-function): ' + method);
        }
        function amplifierMethod(var_args) {
          var privates = table.get(this);
          if (privates) {
            var ampargs = [privates];
            ampargs.push.apply(ampargs, arguments);
            try {
              return method.apply(this, ampargs);
            } catch (e) {
              throw privates._taming.tameException(e);
            }
          } else {
            guard.coerce(this);  // borrow exception
            throw 'can\'t happen';
          }
        }
        amplifierMethod.toString = innocuous(function() {
          return '[' + typename + ']' + method.toString();
        });
        return cajaVM.constFunc(amplifierMethod);
      };

      /**
       * 'amplify(o, f)' is identical to 'amplifying(f).call(o)' but
       * significantly more efficient.
       */
      this.amplify = function(object, method) {
        var privates = table.get(object);
        if (privates) {
          var ampargs = [privates];
          ampargs.push.apply(ampargs, arguments);
          try {
            return method.apply(object, ampargs);
          } catch (e) {
            throw privates._taming.tameException(e);
          }
        } else {
          guard.coerce(object);  // borrow exception
          throw 'can\'t happen';
        }
      };

      this.typename = typename;
    }
    Confidence.prototype.toString = cajaVM.constFunc(function() {
      return this.typename + 'Confidence';
    });

    return cajaVM.def(Confidence);
  })();
  
  /**
   * Explicit marker that this is a function intended to be exported that needs
   * no other wrapping. Also, remove the function's .prototype object.
   *
   * As a matter of style, fn should always be a function literal; think of this
   * as a modifier to function literal syntax. This ensures that it is not
   * misapplied to functions which have more complex circumstances.
   */
  // TODO(kpreid): Verify this in tests, e.g. by adding a property and checking
  function innocuous(f) {
    return cajaVM.constFunc(f);
  }

  var PROPERTY_DESCRIPTOR_KEYS = {
    configurable: 0,
    enumerable: 0,
    writable: 0,
    value: 0,
    get: 0,
    set: 0
  };

  /**
   * Utilities for defining properties.
   */
  var Props = (function() {
    var NO_PROPERTY = null;

    /**
     * Return a function returning an environment. Environments are context
     * implicitly available to our extended property descriptors ('property
     * specifiers') such as the name of the property being defined (so that a
     * single spec can express "forward this property to the same-named property
     * on another object", for example).
     */
    function makeEnvOuter(object, opt_confidence) {
      // TODO(kpreid): confidence typename is not actually currently specific
      // enough for debugging (node subclasses, in particular) but it's the
      // only formal name we have right now.
      var typename = opt_confidence ? opt_confidence.typename : String(object);
      var amplifying = opt_confidence
          ? opt_confidence.amplifying.bind(opt_confidence)
          : function(fn) {
              throw new Error('Props.define: no confidence, no amplifying');
            };
      return function(prop) {
        var msgPrefix = 'Props.define: ' + typename + '.' + prop;
        return {
          object: object,
          prop: prop,
          msgPrefix: msgPrefix,
          amplifying: amplifying
        };
      };
    }

    /**
     * Convert a property spec (our notion) to a property descriptor (ES5
     * notion) and validate/repair/kludge it.
     *
     * The returned property descriptor is fresh.
     */
    function specToDesc(env, propSpec) {
      if (propSpec === NO_PROPERTY) { return propSpec; }
      switch (typeof propSpec) {
        case 'function':
          if (!propSpec.isPropMaker) {
            // TODO(kpreid): Temporary check for refactoring.
            throw new TypeError(env.msgPrefix +
                ' defined with a function not a prop maker');
          }
          return specToDesc(env, propSpec(env));

        case 'object':
          // Make a copy so that we can mutate desc, and validate.
          var desc = copyAndValidateDesc(env, propSpec);

          if ('get' in desc || 'set' in desc) {
            // Firefox bug workaround; see canHaveEnumerableAccessors.
            desc.enumerable = desc.enumerable && canHaveEnumerableAccessors;
          }

          if (desc.get && !Object.isFrozen(desc.get)) {
            if (typeof console !== 'undefined') {
              console.warn(env.msgPrefix + ' getter is not frozen; fixing.');
            }
            cajaVM.constFunc(desc.get);
          }
          if (desc.set && !Object.isFrozen(desc.set)) {
            if (typeof console !== 'undefined') {
              console.warn(env.msgPrefix + ' setter is not frozen; fixing.');
            }
            cajaVM.constFunc(desc.set);
          }

          return desc;

        default:
          throw new TypeError(env.msgPrefix +
              ' spec not a function or descriptor (' + propSpec + ')');
      }
    }

    function copyAndValidateDesc(env, inDesc) {
      var desc = {};
      for (var k in inDesc) {
        if (PROPERTY_DESCRIPTOR_KEYS.hasOwnProperty(k)) {
          // Could imagine doing a type-check here, but not bothering.
          desc[k] = inDesc[k];
        } else {
          throw new TypeError(env.msgPrefix +
              ': Unexpected key in property descriptor: ' + k);
        }
      }
      return desc;
    }

    /**
     * For each enumerable p: s in propSpecs, do
     *
     *   Object.defineProperty(object, p, specToDesc(..., s))
     *
     * where specToDesc() passes plain property descriptors through and can
     * also construct property descriptors based on the specified 'p' or
     * 'confidence' if s is one of the property-maker functions provided by
     * Props.
     *
     * Additionally, getters and setters are checked for being frozen, and the
     * syntax of the descriptor is checked.
     */
    function define(object, opt_confidence, propSpecs) {
      var makeEnv = makeEnvOuter(object, opt_confidence);
      for (var prop in propSpecs) {
        var desc = specToDesc(makeEnv(prop), propSpecs[prop]);
        if (desc !== NO_PROPERTY) {
          Object.defineProperty(object, prop, desc);
        }
      }
    }

    /**
     * A property which behaves as if as it was named the mapName.
     */
    function actAs(mapName, propSpec) {
      return markPropMaker(function(env) {
        return specToDesc(
          Object.create(env, {
            prop: {value: mapName}
          }),
          propSpec);
      });
    }

    /**
     * A getter/setter which forwards to the other-named property of this
     * object.
     *
     * Remember that the other property could have been overridden by the caller
     * if it is inherited!
     */
    function alias(enumerable, otherProp) {
      return {
        enumerable: enumerable,
        get: innocuous(function aliasGetter() { return this[otherProp]; }),
        set: innocuous(function aliasSetter(v) { this[otherProp] = v; })
      };
    }

    /**
     * A non-writable, possibly enumerable, overridable constant-valued
     * property.
     */
    function overridable(enumerable, value) {
      return markPropMaker(function overridablePropMaker(env) {
        return allowNonWritableOverride(env.object, env.prop, {
          enumerable: enumerable,
          value: value
        });
      });
    }

    /**
     * Add override to an accessor property.
     */
    function addOverride(spec) {
      return markPropMaker(function overridablePropMaker(env) {
        var desc = specToDesc(env, spec);
        if ('set' in desc || 'value' in desc) {
          throw new Error('bad addOverride');
        } else {
          desc.set = makeOverrideSetter(env.object, env.prop);
        }
        return desc;
      });
    }

    /**
     * An overridable, enumerable method.
     *
     * fn will have innocuous() applied to it (thus ending up with its
     * .prototype removed).
     *
     * As a matter of style, fn should always be a function literal; think of
     * this as a modifier to function literal syntax. This ensures that it is
     * not misapplied to functions which have more complex circumstances.
     */
    function plainMethod(fn) {
      return overridable(true, innocuous(fn));
    }

    /**
     * An overridable, enumerable, amplifying (as in confidence.amplifying)
     * method.
     *
     * The function should be a function literal.
     */
    function ampMethod(fn) {
      return markPropMaker(function(env) {
        return overridable(true, env.amplifying(fn));
      });
    }

    /**
     * A non-overridable, enumerable, amplifying (as in confidence.amplifying)
     * getter.
     *
     * The function should be a function literal.
     */
    function ampGetter(fn) {
      return markPropMaker(function(env) {
        return {
          enumerable: true,
          get: env.amplifying(fn)
        };
      });
    }

    /**
     * Checkable label for all property specs implemented functions.
     * TODO(kpreid): Have fewer custom property makers outside of Props itself;
     * provide tools to build them instead.
     */
    function markPropMaker(fn) {
      fn.isPropMaker = true;
      // causes a TypeError inside ToPropertyDescriptor
      fn.get = '<PropMaker used as propdesc canary>';
      return fn;
    }

    /**
     * Only define the property if the condition is true.
     *
     * For more complex cases use regular conditionals and NO_PROPERTY.
     */
    function cond(condition, specThen) {
      return condition ? specThen : NO_PROPERTY;
    }

    return {
      define: define,
      actAs: actAs,
      alias: alias,
      overridable: overridable,
      addOverride: addOverride,
      plainMethod: plainMethod,
      ampMethod: ampMethod,
      ampGetter: ampGetter,
      cond: cond,
      NO_PROPERTY: NO_PROPERTY,
      markPropMaker: markPropMaker
    };
  })();

  var CollectionProxyHandler = (function() {
    /**
     * Handler for a proxy which presents value properties derived from an
     * external data source.
     * 
     * The subclass should implement .col_lookup(name) -> internalvalue,
     * .col_evaluate(internalvalue) -> value, and .col_names() -> array.
     */
    function CollectionProxyHandler(target) {
      ProxyHandler.call(this, target);
    }
    inherit(CollectionProxyHandler, ProxyHandler);
    CollectionProxyHandler.prototype.toString = function() {
      return '[CollectionProxyHandler]';
    };
    CollectionProxyHandler.prototype.getOwnPropertyDescriptor =
        function (name) {
      var lookup;
      if ((lookup = this.col_lookup(name))) {
        return {
          configurable: true,  // proxy invariant check
          enumerable: true,  // TODO(kpreid): may vary
          writable: false,
          value: this.col_evaluate(lookup)
        };
      } else {
        return ProxyHandler.prototype.getOwnPropertyDescriptor.call(this, name);
      }
    };
    CollectionProxyHandler.prototype.get = function(receiver, name) {
      var lookup;
      if ((lookup = this.col_lookup(name))) {
        return this.col_evaluate(lookup);
      } else {
        return ProxyHandler.prototype.get.call(this, receiver, name);
      }
    };
    CollectionProxyHandler.prototype.getOwnPropertyNames = function() {
      var names = ProxyHandler.prototype.getOwnPropertyNames.call(this);
      names.push.apply(names, this.col_names());
      return names;
    };
    CollectionProxyHandler.prototype['delete'] = function(name) {
      var lookup;
      if ((lookup = this.col_lookup(name))) {
        return false;
      } else {
        return ProxyHandler.prototype['delete'].call(this, name);
      }
    };
    return cajaVM.def(CollectionProxyHandler);
  }());

  /** XMLHttpRequest or an equivalent on IE 6. */
  function XMLHttpRequestCtor(makeDOMAccessible,
      XMLHttpRequest, ActiveXObject, XDomainRequest) {
    if (XMLHttpRequest &&
      makeDOMAccessible(new XMLHttpRequest()).withCredentials !== undefined) {
      return XMLHttpRequest;
    } else if (XDomainRequest) { 
      return function XDomainRequestObjectForIE() {
        var xdr = makeDOMAccessible(new XDomainRequest());
        xdr.onload = function () {
          if ('function' === typeof xdr.onreadystatechange) {
            xdr.status = 200;
            xdr.readyState = 4;
            xdr.onreadystatechange.call(xdr, null, false);
          }
        };
        var errorHandler = function () {
          if ('function' === typeof xdr.onreadystatechange) {
            xdr.status = 500;
            xdr.readyState = 4;
            xdr.onreadystatechange.call(xdr, null, false);
          }
        };
        xdr.onerror = errorHandler;
        xdr.ontimeout = errorHandler;
        return xdr;
      };
    } else if (ActiveXObject) {
     // The first time the ctor is called, find an ActiveX class supported by
     // this version of IE.
      var activeXClassId;
      return function ActiveXObjectForIE() {
        if (activeXClassId === void 0) {
          activeXClassId = null;
          /** Candidate Active X types. */
          var activeXClassIds = [
              'MSXML2.XMLHTTP.5.0', 'MSXML2.XMLHTTP.4.0',
              'MSXML2.XMLHTTP.3.0', 'MSXML2.XMLHTTP',
              'MICROSOFT.XMLHTTP.1.0', 'MICROSOFT.XMLHTTP.1',
              'MICROSOFT.XMLHTTP'];
          for (var i = 0, n = activeXClassIds.length; i < n; i++) {
            var candidate = activeXClassIds[+i];
            try {
              void new ActiveXObject(candidate);
              activeXClassId = candidate;
              break;
            } catch (e) {
              // do nothing; try next choice
            }
          }
          activeXClassIds = null;
        }
        return new ActiveXObject(activeXClassId);
      };
    } else {
      throw new Error('ActiveXObject not available');
    }
  }

  function TameXMLHttpRequest(
      taming,
      rulebreaker,
      xmlHttpRequestMaker,
      naiveUriPolicy,
      getBaseURL) {
    // See http://www.w3.org/TR/XMLHttpRequest/

    // TODO(ihab.awad): Improve implementation (interleaving, memory leaks)
    // per http://www.ilinsky.com/articles/XMLHttpRequest/

    var TameXHRConf = new Confidence('TameXMLHttpRequest');
    var amplifying = TameXHRConf.amplifying;
    var amplify = TameXHRConf.amplify;

    // Note: Since there is exactly one TameXMLHttpRequest per feral XHR, we do
    // not use an expando proxy and always let clients set expando properties
    // directly on this. This simplifies implementing onreadystatechange.
    function TameXMLHttpRequest() {
      TameXHRConf.confide(this, taming);
      amplify(this, function(privates) {
        var xhr = privates.feral =
            rulebreaker.makeDOMAccessible(new xmlHttpRequestMaker());
        taming.tamesTo(xhr, this);
        
        privates.async = undefined;
        privates.handler = undefined;
        
        Object.preventExtensions(privates);
      });
    }
    Props.define(TameXMLHttpRequest.prototype, TameXHRConf, {
      onreadystatechange: {
        enumerable: true,
        set: amplifying(function(privates, handler) {
          // TODO(ihab.awad): Do we need more attributes of the event than
          // 'target'? May need to implement full "tame event" wrapper similar
          // to DOM events.
          var self = this;
          privates.feral.onreadystatechange = function(event) {
            var evt = { target: self };
            return handler.call(void 0, evt);
          };
          // Store for later direct invocation if need be
          privates.handler = handler;
        })
      },
      // TODO(kpreid): This are PT.ROView properties but our layering does not
      // offer that here.
      readyState: Props.ampGetter(function(privates) {
        // The ready state should be a number
        return Number(privates.feral.readyState);
      }),
      responseText: Props.ampGetter(function(privates) {
        var result = privates.feral.responseText;
        return (result === undefined || result === null)
            ? result : String(result);
      }),
      responseXML: Props.ampGetter(function(privates) {
        var feralXml = privates.feral.responseXML;
        if (feralXml === null || feralXml === undefined) {
          // null = 'The response did not parse as XML.'
          return null;
        } else {
          // TODO(ihab.awad): Implement a taming layer for XML. Requires
          // generalizing the HTML node hierarchy as well so we have a unified
          // implementation.

          // This kludge is just enough to keep the jQuery tests from freezing.
          var node = {nodeName: '#document'};
          node.cloneNode = function () { return node; };
          node.toString = function () {
            return 'Caja does not support XML.';
          };
          return {documentElement: node};
        }
      }),
      status: Props.ampGetter(function(privates) {
        var result = privates.feral.status;
        return (result === undefined || result === null) ?
          result : Number(result);
      }),
      statusText: Props.ampGetter(function(privates) {
        var result = privates.feral.statusText;
        return (result === undefined || result === null) ?
          result : String(result);
      }),
      open: Props.ampMethod(function(
          privates, method, URL, opt_async, opt_userName, opt_password) {
        method = String(method);
        URL = URI.utils.resolve(getBaseURL(), String(URL));
        // The XHR interface does not tell us the MIME type in advance, so we
        // must assume the broadest possible.
        var safeUri = uriRewrite(
            naiveUriPolicy,
            URL, html4.ueffects.SAME_DOCUMENT, html4.ltypes.DATA,
            {
              "TYPE": "XHR",
              "XHR_METHOD": method,
              "XHR": true  // Note: this hint is deprecated
            });
        // If the uriPolicy rejects the URL, we throw an exception, but we do
        // not put the URI in the exception so as not to put the caller at risk
        // of some code in its stack sniffing the URI.
        if ('string' !== typeof safeUri) {
          throw 'URI violates security policy';
        }
        switch (arguments.length) {
        case 2:
          privates.async = true;
          privates.feral.open(method, safeUri);
          break;
        case 3:
          privates.async = opt_async;
          privates.feral.open(method, safeUri, Boolean(opt_async));
          break;
        case 4:
          privates.async = opt_async;
          privates.feral.open(
              method, safeUri, Boolean(opt_async), String(opt_userName));
          break;
        case 5:
          privates.async = opt_async;
          privates.feral.open(
              method, safeUri, Boolean(opt_async), String(opt_userName),
              String(opt_password));
          break;
        default:
          throw 'XMLHttpRequest cannot accept ' + arguments.length +
              ' arguments';
          break;
        }
      }),
      setRequestHeader: Props.ampMethod(function(privates, label, value) {
        privates.feral.setRequestHeader(String(label), String(value));
      }),
      send: Props.ampMethod(function(privates, opt_data) {
        if (arguments.length === 0) {
          // TODO(ihab.awad): send()-ing an empty string because send() with no
          // args does not work on FF3, others?
          privates.feral.send('');
        } else if (typeof opt_data === 'string') {
          privates.feral.send(opt_data);
        } else /* if XML document */ {
          // TODO(ihab.awad): Expect tamed XML document; unwrap and send
          privates.feral.send('');
        }

        // Firefox does not call the 'onreadystatechange' handler in
        // the case of a synchronous XHR. We simulate this behavior by
        // calling the handler explicitly.
        if (privates.feral.overrideMimeType) {
          // This is Firefox
          if (!privates.async && privates.handler) {
            var evt = { target: this };
            privates.handler.call(void 0, evt);
          }
        }
      }),
      abort: Props.ampMethod(function(privates) {
        privates.feral.abort();
      }),
      getAllResponseHeaders: Props.ampMethod(function(privates) {
        var result = privates.feral.getAllResponseHeaders();
        return (result === undefined || result === null) ?
          result : String(result);
      }),
      getResponseHeader: Props.ampMethod(function(privates, headerName) {
        var result = privates.feral.getResponseHeader(String(headerName));
        return (result === undefined || result === null) ?
          result : String(result);
      }),
      toString: Props.overridable(false, innocuous(function() {
        return 'Not a real XMLHttpRequest';
      }))
    });
    return cajaVM.def(TameXMLHttpRequest);
  }

  // TODO(kpreid): Review whether this has unnecessary features (as we're
  // statically generating Style accessors rather than proxy/handler-ing
  // Domita did).
  function CssPropertiesCollection(aStyleObject) {
    var canonicalStylePropertyNames = {};
    // Maps style property names, e.g. cssFloat, to property names, e.g. float.
    var cssPropertyNames = {};

    for (var cssPropertyName in cssSchema) {
      var baseStylePropertyName = cssPropertyName.replace(
          /-([a-z])/g, function (_, letter) { return letter.toUpperCase(); });
      var canonStylePropertyName = baseStylePropertyName;
      cssPropertyNames[baseStylePropertyName]
          = cssPropertyNames[canonStylePropertyName]
          = cssPropertyName;
      var alts = cssSchema[cssPropertyName].cssAlternates;
      if (alts) {
        for (var i = alts.length; --i >= 0;) {
          cssPropertyNames[alts[+i]] = cssPropertyName;
          // Handle oddities like cssFloat/styleFloat.
          if (alts[+i] in aStyleObject
              && !(canonStylePropertyName in aStyleObject)) {
            canonStylePropertyName = alts[+i];
          }
        }
      }
      canonicalStylePropertyNames[cssPropertyName] = canonStylePropertyName;
    }

    return {
      isCanonicalProp: function (p) {
        return cssPropertyNames.hasOwnProperty(p);
      },
      isCssProp: function (p) {
        return canonicalStylePropertyNames.hasOwnProperty(p);
      },
      getCanonicalPropFromCss: function (p) {
        return canonicalStylePropertyNames[p];
      },
      getCssPropFromCanonical: function(p) {
        return cssPropertyNames[p];
      },
      forEachCanonical: function (f) {
        for (var p in cssPropertyNames) {
          if (cssPropertyNames.hasOwnProperty(p)) {
            f(p);
          }
        }
      }
    };
  }

  function TamingClassTable() {
    var self = this;

    var hop = Object.prototype.hasOwnProperty;

    // TODO(kpreid): When ES5/3 and the relevant Chrome bug are dead, make this
    // Object.create(null).
    var thunks = {};

    var prototypeNames = new WeakMap();

    /**
     * Register a lazy-initialized taming ctor. The builder function should
     * return the taming ctor.
     */
    this.registerLazy = function registerLazy(name, builder) {
      if (Object.prototype.hasOwnProperty.call(thunks, name)) {
        throw new Error('TamingClassTable: duplicate registration of ' + name);
      }
      var result = undefined;
      thunks[name] = function tamingClassMemoThunk() {
        if (!result) {
          var tamingCtor = builder();
          var inert = tamingCtor.prototype.constructor;
          // TODO(kpreid): Validate that the inert ctor is in fact inert
          result = {
            tamingCtor: tamingCtor,  // special applications need lack of def
                // here
            guestCtor: cajaVM.def(inert)
          };

          // Registering multiple names is allowed. However, if we ever stop
          // having multiple names (HTMLElement vs. Element, HTMLDocument vs.
          // Document), which would be technically correct, this should become a
          // failure case.
          if (!prototypeNames.has(inert.prototype)) {
            prototypeNames.set(inert.prototype, name);
          }
        }
        return result;
      };
    };

    /**
     * This does three things:
     *
     * Replace tamingCtor's prototype with one whose prototype is someSuper.
     *
     * Hide the constructor of the products of tamingCtor, replacing it with a
     * function which just throws (but can still be used for instanceof
     * checks).
     *
     * Register the inert ctor under the given name if not undefined.
     * TODO(kpreid): Review deprecating that entirely in favor of laziness.
     */
    this.inertCtor = function inertCtor(
        tamingCtor, someSuper, opt_name, opt_writableProto) {
      inherit(tamingCtor, someSuper, opt_writableProto);

      var inert = function domadoInertConstructor() {
        throw new TypeError('This constructor cannot be called directly.');
      };
      var string = opt_name ? '[domado inert constructor ' + opt_name + ']'
                            : '[domado inert constructor]';
      inert.toString = cajaVM.constFunc(function inertCtorToString() {
        return string;
      });
      inert.prototype = tamingCtor.prototype;
      Object.freeze(inert);  // not def, because inert.prototype must remain
      Object.defineProperty(tamingCtor.prototype, 'constructor', {
        value: inert
      });

      if (opt_name !== undefined) {
        self.registerLazy(opt_name, function() { return tamingCtor; });
      }

      return inert;
    };

    // TODO(kpreid): Remove uses of this -- all for the wrong multiple names.
    this.registerSafeCtor = function registerSafeCtor(name, safeCtor) {
      self.registerLazy(name, function() {
        function stubTamingCtor() {
          throw new Error('Should not have been called');
        }
        stubTamingCtor.prototype = { constructor: safeCtor };
        return stubTamingCtor;
      });
    };

    this.finish = function finish() {
      Object.freeze(thunks);
    };

    this.exportTo = function exportTo(imports) {
      if (Object.isExtensible(thunks)) {
        throw new Error(
            'TamingClassTable: exportTo called before defAllAndFinish');
      }
      Object.getOwnPropertyNames(thunks).forEach(function(name) {
        var thunk = thunks[name];
        Object.defineProperty(imports, name, {
          enumerable: true,
          configurable: true,
          get: cajaVM.constFunc(function tamingClassGetter() {
            return thunk().guestCtor;
          }),
          set: cajaVM.constFunc(function tamingClassSetter(newValue) {
            // This differs from the makeOverrideSetter setter in that it allows
            // override on the object itself, not just objects inheriting this
            // descriptor.
            Object.defineProperty(this, name, {
              value: newValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          })
        });
      });
    };

    this.getTamingCtor = function(name) {
      // TODO(kpreid): When we no longer need to support platforms without
      // Object.create(null) (ES5/3, some Chrome), we should throw out this
      // hasOwnProperty.
      return hop.call(thunks, name) ? thunks[name]().tamingCtor : undefined;
    };

    this.getNameOfPrototype = function(prototype) {
      return prototypeNames.get(prototype);
    };
  }

  var NOT_EDITABLE = "Node not editable.";
  var UNSAFE_TAGNAME = "Unsafe tag name.";
  var UNKNOWN_TAGNAME = "Unknown tag name.";
  var INDEX_SIZE_ERROR = "Index size error.";

  /**
   * Authorize the Domado library.
   *
   * The result of this constructor is almost stateless. The exceptions are
   * that each instance has unique trademarks for certain types of tamed
   * objects, and a shared map allowing separate virtual documents to dispatch
   * events across them. (TODO(kpreid): Confirm this explanation is good.)
   *
   * @param {Object} opt_rulebreaker. If necessary, authorities to break the
   *     ES5/3 taming membrane and work with the taming-frame system. If
   *     running under SES, pass null instead.
   * @return A record of functions attachDocument, dispatchEvent, and
   *     dispatchToHandler.
   */
  return cajaVM.constFunc(function Domado_(opt_rulebreaker) {
    // Everything in this scope but not in function attachDocument() below
    // does not contain lexical references to a particular DOM instance, but
    // may have some kind of privileged access to Domado internals.

    // This is only used if opt_rulebreaker is absent (because the plugin ids
    // are normally managed by es53 when it is not). TODO(kpreid): Is there a
    // more sensible place to put this management, which would be used in both
    // modes?
    var importsToId = new WeakMap(true);
    var idToImports = [];
    var nextPluginId = 0;

    // This parameter is supplied in the ES5/3 case and not in the ES5+SES case.
    var rulebreaker = opt_rulebreaker ? opt_rulebreaker : cajaVM.def({
      // These are the stub versions used when in ES5+SES.
      makeDOMAccessible: function (o) {return o;},
      makeFunctionAccessible: function (o) {return o;},
      copyLengthPropertyIfUninterceptable: function (source, target) {},
      writeToPixelArray: function (source, target, length) {
        // See the use below for why this exists.
        for (var i = length-1; i >= 0; i--) {
          target[+i] = source[+i];
        }
      },

      getId: function (imports) {
        if (importsToId.has(imports)) {
          return importsToId.get(imports);
        } else {
          var id = nextPluginId++;
          importsToId.set(imports, id);
          idToImports[id] = imports;
          return id;
        }
      },
      getImports: function (id) {
        var imports = idToImports[id];
        if (imports === undefined) {
          throw new Error('Internal: imports#', id, ' unregistered');
        }
        return imports;
      }
    });

    var makeDOMAccessible = rulebreaker.makeDOMAccessible;
    var makeFunctionAccessible = rulebreaker.makeFunctionAccessible;

    // value transforming/trivial functions
    function noop() { return undefined; }
    function identity(x) { return x; }
    function defaultToEmptyStr(x) { return x || ''; }

    // Array Remove - By John Resig (MIT Licensed)
    function arrayRemove(array, from, to) {
      var rest = array.slice((to || from) + 1 || array.length);
      array.length = from < 0 ? array.length + from : from;
      return array.push.apply(array, rest);
    }

    // It is tempting to name this table "burglar".
    var windowToDomicile = new WeakMap();

    var TameEventConf = new Confidence('TameEvent');
    var TameEventT = TameEventConf.guard;
    var eventAmp = TameEventConf.amplifying;
    var eventAmplify = TameEventConf.amplify;
    var TameImageDataConf = new Confidence('TameImageData');
    var TameImageDataT = TameImageDataConf.guard;
    var TameGradientConf = new Confidence('TameGradient');
    var TameGradientT = TameGradientConf.guard;

    var XML_SPACE = '\t\n\r ';

    var JS_SPACE = '\t\n\r ';
    // An identifier that does not end with __.
    var JS_IDENT = '(?:[a-zA-Z_][a-zA-Z0-9$_]*[a-zA-Z0-9$]|[a-zA-Z])_?';
    var SIMPLE_HANDLER_PATTERN = new RegExp(
        '^[' + JS_SPACE + ']*'
        + '(return[' + JS_SPACE + ']+)?'  // Group 1 is present if it returns.
        + '(' + JS_IDENT + ')[' + JS_SPACE + ']*'  // Group 2 is a func name.
        // Which can be passed optionally the event, and optionally this node.
        + '\\((event'  // Group 3 is present if 1 arg
          + '([' + JS_SPACE + ']*,[' + JS_SPACE + ']*this)?'  //Group 4 if 2 arg
          + '[' + JS_SPACE + ']*)?\\)'
        // And it can end with a semicolon.
        + '[' + JS_SPACE + ']*(?:;?[' + JS_SPACE + ']*)$');

    // These id patterns match the ones in HtmlAttributeRewriter.

    var VALID_ID_CHAR =
        unicode.LETTER + unicode.DIGIT + '_'
        + '$\\-.:;=()\\[\\]'
        + unicode.COMBINING_CHAR + unicode.EXTENDER;

    var VALID_ID_PATTERN = new RegExp(
        '^[' + VALID_ID_CHAR + ']+$');

    var VALID_ID_LIST_PATTERN = new RegExp(
        '^[' + XML_SPACE + VALID_ID_CHAR + ']*$');

    var FORBIDDEN_ID_PATTERN = new RegExp('__\\s*$');

    var FORBIDDEN_ID_LIST_PATTERN = new RegExp('__(?:\\s|$)');

    function isValidId(s) {
      return !FORBIDDEN_ID_PATTERN.test(s)
          && VALID_ID_PATTERN.test(s);
    }

    function isValidFragment(s) {
      var idValue = s.substring(1);
      return s.charAt(0) === '#' && ('' === idValue || isValidId(idValue));
    }

    function isValidIdList(s) {
      return !FORBIDDEN_ID_LIST_PATTERN.test(s)
          && VALID_ID_LIST_PATTERN.test(s);
    }

    // Trim whitespace from the beginning and end of a string, using this
    // definition of whitespace:
    // per http://www.whatwg.org/specs/web-apps/current-work/multipage/common-microsyntaxes.html#space-character
    function trimHTML5Spaces(input) {
      return input.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
    }

    function mimeTypeForAttr(tagName, attribName) {
      if (attribName === 'src') {
        if (tagName === 'img') { return 'image/*'; }
        if (tagName === 'script') { return 'text/javascript'; }
      }
      return '*/*';
    }

    // TODO(ihab.awad): Does this work on IE, where console output
    // goes to a DOM node?
    function assert(cond) {
      if (!cond) {
        if (typeof console !== 'undefined') {
          console.error('domita assertion failed');
          console.trace();
        }
        throw new Error("Domita assertion failed");
      }
    }

    /*
     * Implementations of setTimeout, setInterval, clearTimeout, and
     * clearInterval that only allow simple functions as timeouts and
     * that treat timeout ids as capabilities.
     * This is safe even if accessed across frame since the same
     * map is never used with more than one version of setTimeout.
     */
    function tameSetAndClear(target, set, clear, setName, clearName) {
      var ids = new WeakMap();
      makeFunctionAccessible(set);
      makeFunctionAccessible(clear);
      function tameSet(action, delayMillis) {
        // Existing browsers treat a timeout/interval of null or undefined as a
        // noop.
        var id;
        if (action) {
          if (typeof action !== 'function') {
            // Early error for usability -- we also defend below.
            // This check is not *necessary* for security.
            throw new Error(
                setName + ' called with a ' + typeof action + '.'
                + '  Please pass a function instead of a string of JavaScript');
          }
          // actionWrapper defends against:
          //   * Passing a string-like object which gets taken as code.
          //   * Non-standard arguments to the callback.
          //   * Non-standard effects of callback's return value.
          var actionWrapper = function() {
            action();
          };
          id = set(actionWrapper, delayMillis | 0);
        } else {
          id = undefined;
        }
        var tamed = {};
        ids.set(tamed, id);
        // Freezing is not *necessary*, but it makes testing/reasoning simpler
        // and removes a degree of freedom actual browsers don't provide (they
        // return numbers).
        return Object.freeze(tamed);
      }
      function tameClear(id) {
        // From https://developer.mozilla.org/en/DOM/window.clearTimeout says:
        //   Notes:
        //   Passing an invalid ID to clearTimeout does not have any effect
        //   (and doesn't throw an exception).

        // WeakMap will throw on these, so early exit.
        if (typeof id !== 'object' || id == null) { return; }

        var feral = ids.get(id);
        if (feral !== undefined) clear(feral);  // noop if not found
      }
      target[setName] = cajaVM.def(tameSet);
      target[clearName] = cajaVM.def(tameClear);
      return target;
    }

    function makeScrollable(bridal, element) {
      var overflow = bridal.getComputedStyle(element, void 0).overflow;
      switch (overflow && overflow.toLowerCase()) {
        case 'visible':
        case 'hidden':
          makeDOMAccessible(element.style);
          element.style.overflow = 'auto';
          break;
      }
    }

    /**
     * Moves the given pixel within the element's frame of reference as close to
     * the top-left-most pixel of the element's viewport as possible without
     * moving the viewport beyond the bounds of the content.
     * @param {number} x x-coord of a pixel in the element's frame of reference.
     * @param {number} y y-coord of a pixel in the element's frame of reference.
     */
    function tameScrollTo(element, x, y) {
      if (x !== +x || y !== +y || x < 0 || y < 0) {
        throw new Error('Cannot scroll to ' + x + ':' + typeof x + ','
                        + y + ' : ' + typeof y);
      }
      element.scrollLeft = x;
      element.scrollTop = y;
    }

    /**
     * Moves the origin of the given element's view-port by the given offset.
     * @param {number} dx a delta in pixels.
     * @param {number} dy a delta in pixels.
     */
    function tameScrollBy(element, dx, dy) {
      if (dx !== +dx || dy !== +dy) {
        throw new Error('Cannot scroll by ' + dx + ':' + typeof dx + ', '
                        + dy + ':' + typeof dy);
      }
      element.scrollLeft += dx;
      element.scrollTop += dy;
    }

    function guessPixelsFromCss(cssStr) {
      if (!cssStr) { return 0; }
      var m = cssStr.match(/^([0-9]+)/);
      return m ? +m[1] : 0;
    }

    function tameResizeTo(element, w, h) {
      if (w !== +w || h !== +h) {
        throw new Error('Cannot resize to ' + w + ':' + typeof w + ', '
                        + h + ':' + typeof h);
      }
      makeDOMAccessible(element.style);
      element.style.width = w + 'px';
      element.style.height = h + 'px';
    }

    function tameResizeBy(element, dw, dh) {
      if (dw !== +dw || dh !== +dh) {
        throw new Error('Cannot resize by ' + dw + ':' + typeof dw + ', '
                        + dh + ':' + typeof dh);
      }
      if (!dw && !dh) { return; }

      // scrollWidth is width + padding + border.
      // offsetWidth is width + padding + border, but excluding the non-visible
      // area.
      // clientWidth iw width + padding, and like offsetWidth, clips to the
      // viewport.
      // margin does not count in any of these calculations.
      //
      // scrollWidth/offsetWidth
      //   +------------+
      //   |            |
      //
      // +----------------+
      // |                | Margin-top
      // | +------------+ |
      // | |############| | Border-top
      // | |#+--------+#| |
      // | |#|        |#| | Padding-top
      // | |#| +----+ |#| |
      // | |#| |    | |#| | Height
      // | |#| |    | |#| |
      // | |#| +----+ |#| |
      // | |#|        |#| |
      // | |#+--------+#| |
      // | |############| |
      // | +------------+ |
      // |                |
      // +----------------+
      //
      //     |        |
      //     +--------+
      //     clientWidth (but excludes content outside viewport)

      var style = makeDOMAccessible(element.currentStyle);
      if (!style) {
        style = makeDOMAccessible(
            bridalMaker.getWindow(element, makeDOMAccessible)
            .getComputedStyle(element, void 0));
      }

      makeDOMAccessible(element.style);

      // We guess the padding since it's not always expressed in px on IE
      var extraHeight = guessPixelsFromCss(style.paddingBottom)
          + guessPixelsFromCss(style.paddingTop);
      var extraWidth = guessPixelsFromCss(style.paddingLeft)
          + guessPixelsFromCss(style.paddingRight);

      var goalHeight = element.clientHeight + dh;
      var goalWidth = element.clientWidth + dw;

      var h = goalHeight - extraHeight;
      var w = goalWidth - extraWidth;

      if (dh) { element.style.height = Math.max(0, h) + 'px'; }
      if (dw) { element.style.width = Math.max(0, w) + 'px'; }

      // Correct if our guesses re padding and borders were wrong.
      // We may still not be able to resize if e.g. the deltas would take
      // a dimension negative.
      if (dh && element.clientHeight !== goalHeight) {
        var hError = element.clientHeight - goalHeight;
        element.style.height = Math.max(0, h - hError) + 'px';
      }
      if (dw && element.clientWidth !== goalWidth) {
        var wError = element.clientWidth - goalWidth;
        element.style.width = Math.max(0, w - wError) + 'px';
      }
    }

    /**
     * Access policies
     *
     * Each of these objects is a policy for what type of access (read/write,
     * read-only, or none) is permitted to a Node or NodeList. Each policy
     * object determines the access for the associated node and its children.
     * The childPolicy may be overridden if the node is an opaque or foreign
     * node.
     *
     * Definitions:
     *    childrenVisible:
     *      This node appears to have the children it actually does; otherwise,
     *      appears to have no children.
     *    attributesVisible:
     *      This node appears to have the attributes it actually does;
     *      otherwise, appears to have no attributes.
     *    editable:
     *      This node's attributes and properties (other than children) may be
     *      modified.
     *    childrenEditable:
     *      This node's childNodes list may be modified, and its children are
     *      both editable and childrenEditable.
     *
     * These flags can express several meaningless cases; in particular, the
     * 'editable but not visible' cases do not occur.
     */
    var protoNodePolicy = {
      requireEditable: function () {
        if (!this.editable) {
          throw new Error(NOT_EDITABLE);
        }
      },
      requireChildrenEditable: function () {
        if (!this.childrenEditable) {
          throw new Error(NOT_EDITABLE);
        }
      },
      requireUnrestricted: function () {
        if (!this.unrestricted) {
          throw new Error("Node is restricted");
        }
      },
      assertRestrictedBy: function (policy) {
        if (!this.childrenVisible   && policy.childrenVisible ||
            !this.attributesVisible && policy.attributesVisible ||
            !this.editable          && policy.editable ||
            !this.childrenEditable  && policy.childrenEditable ||
            !this.upwardNavigation  && policy.upwardNavigation ||
            !this.unrestricted      && policy.unrestricted) {
          throw new Error("Domado internal error: non-monotonic node policy");
        }
      }
    };
    // We eagerly await ES6 offering some kind of literal-with-prototype...
    var nodePolicyEditable = Object.create(protoNodePolicy);
    nodePolicyEditable.toString = function () { return "nodePolicyEditable"; };
    nodePolicyEditable.childrenVisible = true;
    nodePolicyEditable.attributesVisible = true;
    nodePolicyEditable.editable = true;
    nodePolicyEditable.childrenEditable = true;
    nodePolicyEditable.upwardNavigation = true;
    nodePolicyEditable.unrestricted = true;
    nodePolicyEditable.childPolicy = nodePolicyEditable;

    var nodePolicyReadOnly = Object.create(protoNodePolicy);
    nodePolicyReadOnly.toString = function () { return "nodePolicyReadOnly"; };
    nodePolicyReadOnly.childrenVisible = true;
    nodePolicyReadOnly.attributesVisible = true;
    nodePolicyReadOnly.editable = false;
    nodePolicyReadOnly.childrenEditable = false;
    nodePolicyReadOnly.upwardNavigation = true;
    nodePolicyReadOnly.unrestricted = true;
    nodePolicyReadOnly.childPolicy = nodePolicyReadOnly;

    var nodePolicyReadOnlyChildren = Object.create(protoNodePolicy);
    nodePolicyReadOnlyChildren.toString =
        function () { return "nodePolicyReadOnlyChildren"; };
    nodePolicyReadOnlyChildren.childrenVisible = true;
    nodePolicyReadOnlyChildren.attributesVisible = true;
    nodePolicyReadOnlyChildren.editable = true;
    nodePolicyReadOnlyChildren.childrenEditable = false;
    nodePolicyReadOnlyChildren.upwardNavigation = true;
    nodePolicyReadOnlyChildren.unrestricted = true;
    nodePolicyReadOnlyChildren.childPolicy = nodePolicyReadOnly;

    var nodePolicyOpaque = Object.create(protoNodePolicy);
    nodePolicyOpaque.toString = function () { return "nodePolicyOpaque"; };
    nodePolicyOpaque.childrenVisible = true;
    nodePolicyOpaque.attributesVisible = false;
    nodePolicyOpaque.editable = false;
    nodePolicyOpaque.childrenEditable = false;
    nodePolicyOpaque.upwardNavigation = true;
    nodePolicyOpaque.unrestricted = false;
    nodePolicyOpaque.childPolicy = nodePolicyReadOnly;

    var nodePolicyForeign = Object.create(protoNodePolicy);
    nodePolicyForeign.toString = function () { return "nodePolicyForeign"; };
    nodePolicyForeign.childrenVisible = false;
    nodePolicyForeign.attributesVisible = false;
    nodePolicyForeign.editable = false;
    nodePolicyForeign.childrenEditable = false;
    nodePolicyForeign.upwardNavigation = false;
    nodePolicyForeign.unrestricted = false;
    Object.defineProperty(nodePolicyForeign, "childPolicy", {
      get: function () {
        throw new Error("Foreign node childPolicy should never be consulted");
      }
    });
    cajaVM.def([
      nodePolicyEditable,
      nodePolicyReadOnly,
      nodePolicyReadOnlyChildren,
      nodePolicyOpaque,
      nodePolicyForeign
    ]);

    // Used for debugging policy decisions; see calls in TameBackedNode.
    //function TracedNodePolicy(policy, note, source) {
    //  var wrap = Object.create(policy);
    //  wrap.trace = [note, source].concat(source && source.trace || []);
    //  wrap.toString = function() {
    //    return policy.toString() + "<<" + wrap.trace + ">>";
    //  });
    //  return wrap;
    //}

    /**
     * Add a tamed document implementation to a Gadget's global scope.
     *
     * Has the side effect of adding the classes "vdoc-container___" and
     * idSuffix.substring(1) to the containerNode.
     *
     * @param {string} idSuffix a string suffix appended to all node IDs.
     *     It should begin with "-" and end with "___".
     * @param {Object} uriPolicy an object like <pre>{
     *   rewrite: function (uri, uriEffect, loaderType, hints) {
     *      return safeUri
     *   }
     * }</pre>.
     *       * uri: the uri to be rewritten
     *       * uriEffect: the effect that allowing a URI to load has (@see
     *         UriEffect.java).
     *       * loaderType: type of loader that would load the URI or the
     *         rewritten
     *         version.
     *       * hints: record that describes the context in which the URI
     *         appears.
     *         If a hint is not present it should not be relied upon.
     *     The rewrite function should be idempotent to allow rewritten HTML
     *     to be reinjected. The policy must be a tamed object.
     * @param {Node} containerNode an HTML node to contain the children of the
     *     virtual Document node provided to Cajoled code.
     * @param {Object} optTargetAttributePresets a record containing the presets
     *     (default and whitelist) for the HTML "target" attribute.
     * @param {Object} taming. An interface to a taming membrane.
     * @return {Object} A collection of privileged access tools, plus the tamed
     *     {@code document} and {@code window} objects under those names. This
     *     object is known as a "domicile".
     */
    function attachDocument(
      idSuffix, naiveUriPolicy, containerNode, optTargetAttributePresets,
        taming) {

      if (arguments.length < 3) {
        throw new Error(
            'attachDocument arity mismatch: ' + arguments.length);
      }
      if (!optTargetAttributePresets) {
        optTargetAttributePresets = {
          'default': '_blank',
          whitelist: [ '_blank', '_self' ]
        };
      }
      // Force naiveUriPolicy to be a tamed object to avoid hazards; this will
      // throw 'host object leaked' otherwise. TODO(kpreid): Be more explicit
      // about intent to enforce (unfortunately, isDefinedInCajaFrame is not
      // directly available to us here).
      taming.untame(naiveUriPolicy);

      var domicile = {
        // True when we're executing a handler for events like click
        handlingUserAction: false
      };
      var pluginId;

      var vdocContainsForeignNodes = false;

      containerNode = makeDOMAccessible(containerNode);
      var document = containerNode.nodeType === 9  // Document node
          ? containerNode
          : containerNode.ownerDocument;
      document = makeDOMAccessible(document);
      var bridal = bridalMaker(makeDOMAccessible, document);
      var elementForFeatureTests =
          makeDOMAccessible(document.createElement('div'));

      var window = bridalMaker.getWindow(containerNode, makeDOMAccessible);
      window = makeDOMAccessible(window);

      var elementPolicies = {};
      elementPolicies.form = function (attribs) {
        // Forms must have a gated onsubmit handler or they must have an
        // external target.
        var sawHandler = false;
        for (var i = 0, n = attribs.length; i < n; i += 2) {
          if (attribs[+i] === 'onsubmit') {
            sawHandler = true;
          }
        }
        if (!sawHandler) {
          attribs.push('onsubmit', 'return false');
        }
        return forceAutocompleteOff(attribs);
      };
      elementPolicies.input = function (attribs) {
        return forceAutocompleteOff(attribs);
      };

      function forceAutocompleteOff(attribs) {
        var a = [];
        for (var i = 0, n = attribs.length; i < n; i += 2) {
          if (attribs[+i] !== 'autocomplete') {
            a.push(attribs[+i], attribs[+i+1]);
          }
        }
        a.push('autocomplete', 'off');
        return a;
      }

      // TODO(kpreid): should elementPolicies be exported in domicile?

      // On IE, turn <canvas> tags into canvas elements that explorercanvas
      // will recognize
      bridal.initCanvasElements(containerNode);

      var tamingClassTable = new TamingClassTable();
      var inertCtor = tamingClassTable.inertCtor.bind(tamingClassTable);

      // Table of functions which are what WebIDL calls [NamedConstructor]
      // (Caveat: In actual browsers, e.g. new Image().constructor === Image !==
      // HTMLImageElement. We don't implement that.)
      var namedConstructors = {};

      // The private properties used in TameNodeConf are:
      //    feral (feral node)
      //    policy (access policy)
      //    Several specifically for TameHTMLDocument.
      // Furthermore, by virtual of being scoped inside attachDocument,
      // TameNodeT also indicates that the object is a node from the *same*
      // virtual document.
      // TODO(kpreid): Review how necessary it is to scope this inside
      // attachDocument. The issues are:
      //   * Using authority or types from a different virtual document (check
      //     the things that used to be TameHTMLDocument.doc___ in particular)
      //   * Using nodes from a different real document (Domita would seem to
      //     be vulnerable to this?)
      var TameNodeConf = new Confidence('TameNode');
      var TameNodeT = TameNodeConf.guard;
      var nodeAmp = TameNodeConf.amplifying;
      var nodeAmplify = TameNodeConf.amplify;

      var tameException = taming.tameException;

      /**
       * Call this on every TameNode after it is constructed, and use its return
       * value instead of the node.
       *
       * TODO(kpreid): Is this the best way to handle things which need to be
       * done after the outermost constructor?
       */
      function finishNode(node) {
        nodeAmplify(node, function(privates) {
          if (proxiesAvailable && privates.proxyHandler) {
            // The proxy construction is deferred until now because the ES5/3
            // implementation of proxies requires that the proxy's prototype is
            // frozen.
            var proxiedNode = Proxy.create(privates.proxyHandler,
                Object.getPrototypeOf(node));
            delete privates.proxyHandler;  // no longer needed

            TameNodeConf.confide(proxiedNode, taming, node);

            // special case for ES5/3 lack of interposition on 'length'
            rulebreaker.copyLengthPropertyIfUninterceptable(node, proxiedNode);

            node = proxiedNode;
          }

          var feral = privates.feral;
          if (feral) {
            if (feral.nodeType === 1) {
              // Elements must only be tamed once; to do otherwise would be
              // a bug in Domado.
              taming.tamesTo(feral, node);
            } else {
              // Other node types are tamed every time they are encountered;
              // we simply remember the latest taming here.
              // TODO(kpreid): Review whether this is still desired and
              // consistent behavior.
              taming.reTamesTo(feral, node);
            }
          } else {
            // If guest code passes a node of its own with no feral counterpart
            // to host code, we pass the empty object "{}". This is a safe
            // behavior until experience determines we need something more
            // complex.
            taming.tamesTo({}, node);
          }

          // Require all properties of the private state record to have already
          // been created (presumably in the constructor). This is so that the
          // use of the namespace can be more easily audited.
          Object.preventExtensions(privates);
        });

        return node;
      }

      /**
       * Sanitizes the value of a CSS property, the {@code red} in
       * {@code color:red}.
       * @param cssPropertyName a canonical CSS property name
       *    {@code "font-family"} not {@code "fontFamily"}.
       */
      function sanitizeStyleProperty(cssPropertyName, tokens) {
        var schema = cssSchema[cssPropertyName];
        if (!schema) {
          tokens.length = 0;
          return false;
        }
        sanitizeCssProperty(
            cssPropertyName,
            schema, tokens,
            naiveUriPolicy
            ? function (url) {
                return uriRewrite(
                    naiveUriPolicy,
                    url, html4.ueffects.SAME_DOCUMENT,
                    html4.ltypes.SANDBOXED,
                    {
                      "TYPE": "CSS",
                      "CSS_PROP": cssPropertyName
                    });
              }
            : null,
            domicile.pseudoLocation.href);
        return tokens.length !== 0;
      }

      /**
       * Sanitize the 'style' attribute value of an HTML element.
       *
       * @param styleAttrValue the value of a 'style' attribute, which we
       * assume has already been checked by the caller to be a plain String.
       *
       * @return a sanitized version of the attribute value.
       */
      function sanitizeStyleAttrValue(styleAttrValue) {
        var sanitizedDeclarations = [];
        parseCssDeclarations(
            String(styleAttrValue),
            {
              declaration: function (property, value) {
                property = property.toLowerCase();
                sanitizeStyleProperty(property, value);
                sanitizedDeclarations.push(property + ': ' + value.join(' '));
              }
            });
        return sanitizedDeclarations.join(' ; ');
      }

      /** Sanitize HTML applying the appropriate transformations. */
      function sanitizeHtml(htmlText) {
        var out = [];
        htmlSanitizer(htmlText, out);
        return out.join('');
      }
      /** Sanitize the array of attributes (side effect) */
      function sanitizeAttrs(tagName, attribs) {
        var n = attribs.length;
        var needsTargetAttrib =
            html4.ATTRIBS.hasOwnProperty(tagName + '::target');
        for (var i = 0; i < n; i += 2) {
          var attribName = attribs[+i];
          if ('target' === attribName) { needsTargetAttrib = false; }
          var value = attribs[+i + 1];
          var atype = null, attribKey;
          if ((attribKey = tagName + '::' + attribName,
               html4.ATTRIBS.hasOwnProperty(attribKey)) ||
              (attribKey = '*::' + attribName,
               html4.ATTRIBS.hasOwnProperty(attribKey))) {
            atype = html4.ATTRIBS[attribKey];
            value = rewriteAttribute(tagName, attribName, atype, value);
            if (atype === html4.atype.URI &&
              !!value && value.charAt(0) === '#') {
              needsTargetAttrib = false;
            }
          } else if (!/__$/.test(attribKey)) {
            attribName = attribs[+i] = cajaPrefix + attribs[+i];
          } else {
            value = null;
          }
          if (value !== null && value !== void 0) {
            attribs[+i + 1] = value;
          } else {
            // Swap last attribute name/value pair in place, and reprocess here.
            // This could affect how user-agents deal with duplicate attributes.
            attribs[+i + 1] = attribs[--n];
            attribs[+i] = attribs[--n];
            i -= 2;
          }
        }
        attribs.length = n;
        if (needsTargetAttrib) {
          attribs.push('target', optTargetAttributePresets['default']);
        }
        var policy = elementPolicies[tagName];
        if (policy && elementPolicies.hasOwnProperty(tagName)) {
          return policy(attribs);
        }
        return attribs;
      }
      function tagPolicy(tagName, attrs) {
        var schemaElem = htmlSchema.element(tagName);
        if (!schemaElem.allowed) {
          if (schemaElem.shouldVirtualize) {
            return {
              tagName: htmlSchema.virtualToRealElementName(tagName),
              attribs: sanitizeAttrs(tagName, attrs)
            };
          } else {
            return null;
          }
        } else {
          return {
            attribs: sanitizeAttrs(tagName, attrs)
          };
        }
      }
      var htmlSanitizer = html.makeHtmlSanitizer(tagPolicy);

      /**
       * If str ends with suffix,
       * and str is not identical to suffix,
       * then return the part of str before suffix.
       * Otherwise return fail.
       */
      function unsuffix(str, suffix, fail) {
        if (typeof str !== 'string') return fail;
        var n = str.length - suffix.length;
        if (0 < n && str.substring(n) === suffix) {
          return str.substring(0, n);
        } else {
          return fail;
        }
      }

      var ID_LIST_PARTS_PATTERN = new RegExp(
        '([^' + XML_SPACE + ']+)([' + XML_SPACE + ']+|$)', 'g');

      /** Convert a real attribute value to the value seen in a sandbox. */
      function virtualizeAttributeValue(attrType, realValue) {
        realValue = String(realValue);
        switch (attrType) {
          case html4.atype.GLOBAL_NAME:
          case html4.atype.ID:
          case html4.atype.IDREF:
            return unsuffix(realValue, idSuffix, null);
          case html4.atype.IDREFS:
            return realValue.replace(ID_LIST_PARTS_PATTERN,
                function(_, id, spaces) {
                  return unsuffix(id, idSuffix, '') + (spaces ? ' ' : '');
                });
          case html4.atype.URI:
            if (realValue && '#' === realValue.charAt(0)) {
              return unsuffix(realValue, idSuffix, realValue);
            } else {
              return realValue;
            }
          case html4.atype.URI_FRAGMENT:
            if (realValue && '#' === realValue.charAt(0)) {
              return unsuffix(realValue, idSuffix, null);
            } else {
              return null;
            }
          default:
            return realValue;
        }
      }

      function getSafeTargetAttribute(tagName, attribName, value) {
        if (value !== null) {
          value = String(value);
          for (var i = 0; i < optTargetAttributePresets.whitelist.length; ++i) {
            if (optTargetAttributePresets.whitelist[i] === value) {
              return value;
            }
          }
        }
        return optTargetAttributePresets['default'];
      }

      /**
       * Returns a normalized attribute value, or null if the attribute should
       * be omitted.
       * <p>This function satisfies the attribute rewriter interface defined in
       * {@link html-sanitizer.js}.  As such, the parameters are keys into
       * data structures defined in {@link html4-defs.js}.
       *
       * @param {string} tagName a canonical tag name.
       * @param {string} attribName a canonical tag name.
       * @param type as defined in html4-defs.js.
       *
       * @return {string|null} null to indicate that the attribute should not
       *   be set.
       */
      function rewriteAttribute(tagName, attribName, type, value) {
        switch (type) {
          case html4.atype.NONE:
            // TODO(felix8a): annoying that this has to be in two places
            if (attribName === 'autocomplete'
                && (tagName === 'input' || tagName === 'form')) {
              return 'off';
            }
            return String(value);
          case html4.atype.CLASSES:
            // note, className is arbitrary CDATA.
            value = String(value);
            if (!FORBIDDEN_ID_LIST_PATTERN.test(value)) {
              return value;
            }
            return null;
          case html4.atype.GLOBAL_NAME:
          case html4.atype.ID:
          case html4.atype.IDREF:
            value = String(value);
            if (value && isValidId(value)) {
              return value + idSuffix;
            }
            return null;
          case html4.atype.IDREFS:
            value = String(value);
            if (value && isValidIdList(value)) {
              return value.replace(ID_LIST_PARTS_PATTERN,
                  function(_, id, spaces) {
                    return id + idSuffix + (spaces ? ' ' : '');
                  });
            }
            return null;
          case html4.atype.LOCAL_NAME:
            value = String(value);
            if (value && isValidId(value)) {
              return value;
            }
            return null;
          case html4.atype.SCRIPT:
            value = String(value);
            var fnNameExpr, doesReturn, argCount;
            var match = value.match(SIMPLE_HANDLER_PATTERN);
            if (match) {
              // Translate a handler that calls a simple function like
              //   return foo(this, event)
              doesReturn = !!match[1];
              fnNameExpr = '"' + match[2] + '"';
                  // safe because match[2] must be an identifier
              argCount =
                  match[4] !== undefined ? 2 :
                  match[3] !== undefined ? 1 : 0;
            } else if (cajaVM.compileExpr) {
              // Compile arbitrary handler code (only in SES mode)
              doesReturn = true;
              var handlerFn = cajaVM.compileExpr(
                '(function(event) { ' + value + ' })'
              )(tameWindow);
              fnNameExpr = domicile.handlers.push(handlerFn) - 1;
              argCount = 1;
            } else {
              if (typeof console !== 'undefined') {
                console.log('Cannot emulate complex event handler ' + tagName +
                    ' ' + attribName + '="' + value + '" in ES5/3 mode');
              }
              return "/*not supported*/";
            }
            var trustedHandler = (doesReturn ? 'return ' : '')
                + '___.plugin_dispatchEvent___('
                + 'this, event, ' + pluginId + ', '
                + fnNameExpr + ', ' + argCount + ');';
            if (attribName === 'onsubmit') {
              trustedHandler =
                'try { ' + trustedHandler + ' } finally { return false; }';
            }
            return trustedHandler;
          case html4.atype.URI:
            value = String(value);
            // URI fragments reference contents within the document and
            // aren't subject to the URI policy
            if (isValidFragment(value)) {
              return value + idSuffix;
            }
            value = URI.utils.resolve(domicile.pseudoLocation.href, value);
            if (!naiveUriPolicy) { return null; }
            var schemaAttr = htmlSchema.attribute(tagName, attribName);
            return uriRewrite(
                naiveUriPolicy,
                value,
                schemaAttr.uriEffect,
                schemaAttr.loaderType,
                {
                  "TYPE": "MARKUP",
                  "XML_ATTR": attribName,
                  "XML_TAG": tagName
                }) || null;
          case html4.atype.URI_FRAGMENT:
            value = String(value);
            if (isValidFragment(value)) {
              return value + idSuffix;
            }
            return null;
          case html4.atype.STYLE:
            return sanitizeStyleAttrValue(String(value));
          case html4.atype.FRAME_TARGET:
            return getSafeTargetAttribute(tagName, attribName, value);
          default:
            return null;
        }
      }

      /**
       * Given a guest-provided attribute name, produce the corresponding
       * name to use in the actual DOM. Note that in the general case,
       * attributes' values are also to be rewritten, so this should only be
       * used for obtaining attribute <em>nodes<em>.
       */
      function rewriteAttributeName(feralElement, attribName) {
        attribName = attribName.toLowerCase();
        if (/__$/.test(attribName)) {
          throw new TypeError('Attributes may not end with __');
        }
        var tagName = feralElement.tagName.toLowerCase();
        var atype = htmlSchema.attribute(tagName, attribName).type;
        if (atype === void 0) {
          return cajaPrefix + attribName;
        } else {
          return attribName;
        }
      }

      // Implementation of HTML5 "HTML fragment serialization algorithm"
      // per http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#html-fragment-serialization-algorithm
      // as of 2012-09-11.
      //
      // Per HTML5: "Warning! It is possible that the output of this algorithm,
      // if parsed with an HTML parser, will not return the original tree
      // structure." Therefore, an innerHTML round-trip on a safe (from Caja's
      // perspective) but malicious DOM may be able to attack guest code.
      // TODO(kpreid): Evaluate desirability of prohibiting the worst cases of
      // this in our DOM mutators.
      function htmlFragmentSerialization(tameRoot) {
        tameRoot = TameNodeT.coerce(tameRoot);
        var sl = [];

        // Note: This algorithm is implemented in terms of tame nodes, not
        // feral nodes; therefore, it requires no access checks as it yields
        // only information which clients can obtain by object access.
        function recur(tameParent) {
          var nodes = tameParent.childNodes;
          var nNodes = nodes.length;
          for (var i = 0; i < nNodes; i++) {
            var tameCurrent = nodes.item(i);
            switch (tameCurrent.nodeType) {
              case 1:  // Element
                // TODO(kpreid): namespace issues
                var tagName = tameCurrent.tagName;
                if (tagName === undefined) {
                  // foreign node case
                  continue;
                }
                tagName = tagName.toLowerCase();
                    // TODO(kpreid): not conformant
                sl.push('<', tagName);
                var attrs = tameCurrent.attributes;
                var nAttrs = attrs.length;
                for (var j = 0; j < nAttrs; j++) {
                  var attr = attrs.item(j);
                  var aName = attr.name;
                  if (aName === 'target') {
                    // hide Caja-added link target attributes
                    // TODO(kpreid): Shouldn't these be hidden in the attributes
                    // list? This special case (and the one below) is emulating
                    // tested-for behavior in a previous .innerHTML
                    // implementation, not written from first principles.
                    continue;
                  }
                  var aValue = attr.value;
                  if (aValue === null) {
                    // rejected by virtualizeAttributeValue
                    // TODO(kpreid): Shouldn't these be hidden in the attributes
                    // list?
                    continue;
                  }
                  // TODO(kpreid): check escapeAttrib conformance
                  sl.push(' ', attr.name, '="', html.escapeAttrib(aValue), '"');
                }
                sl.push('>');
                switch (tagName) {
                  case 'area':
                  case 'base':
                  case 'basefont':
                  case 'bgsound':
                  case 'br':
                  case 'col':
                  case 'command':
                  case 'embed':
                  case 'frame':
                  case 'hr':
                  case 'img':
                  case 'input':
                  case 'keygen':
                  case 'link':
                  case 'meta':
                  case 'param':
                  case 'source':
                  case 'track':
                  case 'wbr':
                    // do nothing
                    break;
                  case 'pre':
                  case 'textarea':
                  case 'listing':
                    if (tameCurrent.firstChild &&
                        tameCurrent.firstChild.nodeType === 3 &&
                        tameCurrent.firstChild.data[0] === '\n') {
                      sl.push('\n');
                    }
                    // fallthrough
                  default:
                    recur(tameCurrent);
                    sl.push('</', tagName, '>');
                }
                break;
              case 3:  // Text
                switch (tameCurrent.parentNode.tagName.toLowerCase()) {
                    // TODO(kpreid): namespace
                  case 'style':
                  case 'script':
                  case 'xmp':
                  case 'iframe':
                  case 'noembed':
                  case 'noframes':
                  case 'plaintext':
                  case 'noscript':
                    sl.push(tameCurrent.data);
                    break;
                  default:
                    sl.push(html.escapeAttrib(tameCurrent.data));
                    break;
                }
                break;
              case 8:  // Comment
                sl.push('<', '!--', tameCurrent.data, '-->');
                break;
              case 7:  // ProcessingInstruction
                sl.push('<?', tameCurrent.target, ' ', tameCurrent.data, '>');
                break;
              case 10:  // DocumentType
                sl.push('<', '!DOCTYPE ', tameCurrent.name, '>');
                break;
              default:
                if (typeof console !== 'undefined') {
                  console.error('Domado internal: HTML fragment serialization '
                      + 'algorithm met unexpected node type '
                      + tameCurrent.nodeType);
                }
                break;
            }
          }
        }
        recur(tameRoot);

        return sl.join('');
      }

      // Property descriptors which are independent of any feral object.
      /**
       * Property descriptor which throws on access.
       */
      var P_UNIMPLEMENTED = {
        enumerable: true,
        get: cajaVM.constFunc(function () {
          throw new Error('Not implemented');
        })
      };
      /**
       * Property descriptor for an unsettable constant attribute (like DOM
       * attributes such as nodeType).
       */
      function P_constant(value) {
        return { enumerable: true, value: value };
      }

      /**
       * Property specs (as for Props.define) suitable for taming wrappers where
       * confidence.p(obj).feral is the feral object to forward to and
       * confidence.p(obj).policy is a node policy object for writability
       * decisions.
       *
       * Lowercase properties are property descriptors; uppercase ones are
       * constructors for parameterized property descriptors.
       *
       * The taming membrane is applied to values. This should not actually
       * matter because these are intended to be used for primitive-valued
       * properties; we tame as a shortcut to protect against unexpected
       * behavior (or misuse) causing breaches.
       */
      var PT = cajaVM.def({
        /**
         * Ensure that a taming wrapper for the given underlying property is
         * memoized via the taming membrane, but only if 'memo' is true.
         */
        TameMemoIf: function(memo, feralProp, tamer) {
          assert(typeof memo === 'boolean');  // in case of bad data
          return Props.markPropMaker(function(env) {
            return {
              enumerable: true,
              get: memo ? env.amplifying(function(privates) {
                var feral = privates.feral[feralProp];
                if (!taming.hasTameTwin(feral)) {
                  taming.tamesTo(feral, tamer.call(this, feral));
                }
                return taming.tame(feral);
              }) : env.amplifying(function(privates) {
                return tamer.call(this, privates.feral[feralProp]);
              })
            };
          });
        },

        /**
         * Property descriptor for properties which have the value the feral
         * object does and are not assignable.
         */
        ro: Props.markPropMaker(function(env) {
          var prop = env.prop;
          return {
            enumerable: true,
            get: env.amplifying(function(privates) {
              return taming.tame(privates.feral[prop]);
            })
          };
        }),

        /**
         * Property descriptor for properties which have a transformed view of
         * the value the feral object does and are not assignable.
         */
        ROView: function(transform) {
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            return {
              enumerable: true,
              get: env.amplifying(function(privates) {
                return transform(privates.feral[prop]);
              })
            };
          });
        },

        /**
         * Property descriptor for properties which have the value the feral
         * object does, and are assignable if the wrapper is editable.
         */
        rw: Props.markPropMaker(function(env) {
          var prop = env.prop;
          return {
            enumerable: true,
            get: env.amplifying(function(privates) {
              return taming.tame(privates.feral[prop]);
            }),
            set: env.amplifying(function(privates, value) {
              privates.policy.requireEditable();
              privates.feral[prop] = taming.untame(value);
            })
          };
        }),

        /**
         * Property descriptor for properties which have the value the feral
         * object does, and are assignable (with a predicate restricting the
         * values which may be assigned) if the wrapper is editable.
         * TODO(kpreid): Use guards instead of predicates.
         */
        RWCond: function(predicate) {
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            return {
              enumerable: true,
              get: env.amplifying(function(privates) {
                return taming.tame(privates.feral[prop]);
              }),
              set: env.amplifying(function(privates, value) {
                privates.policy.requireEditable();
                if (predicate(value)) {
                  privates.feral[prop] = taming.untame(value);
                }
              })
            };
          });
        },

        /**
         * Property descriptor for forwarded properties which have node values
         * which may be nodes that might be outside of the virtual document.
         */
        related: Props.markPropMaker(function(env) {
          var prop = env.prop;
          return {
            enumerable: true,
            get: env.amplifying(function(privates) {
              if (privates.policy.upwardNavigation) {
                // TODO(kpreid): Can we move this check *into*
                // tameRelatedNode?
                return tameRelatedNode(privates.feral[prop]);
              } else {
                return null;
              }
            })
          };
        }),

        /**
         * Property descriptor which maps to an attribute or property, is
         * assignable, and has the value transformed in some way.
         * @param {boolean} useAttrGetter true if the getter should delegate
         *     to {@code this.getAttribute}.  That method is assumed to
         *     already be trusted though {@code toValue} is still called on
         *     the result.
         *     If false, then {@code toValue} is called on the result of
         *     accessing the name property on the underlying element, a
         *     possibly untrusted value.
         * @param {Function} toValue transforms the attribute or underlying
         *     property value retrieved according to the useAttrGetter flag
         *     above to the value of the defined property.
         * @param {boolean} useAttrSetter like useAttrGetter but for a setter.
         *     Switches between the name property on the underlying node
         *     (the false case) or using this's {@code setAttribute} method
         *     (the true case).
         * @param {Function} fromValue called on the input before it is passed
         *     through according to the flag above.  This receives untrusted
         *     values, and can do any vetting or transformation.  If
         *     {@code useAttrSetter} is true then it need not do much value
         *     vetting since the {@code setAttribute} method must do its own
         *     vetting.
         */
        filter: function(useAttrGetter, toValue, useAttrSetter, fromValue) {
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            var desc = {
              enumerable: true,
              get: useAttrGetter
                  ? innocuous(function() {
                      return toValue.call(this, this.getAttribute(prop));
                    })
                  : env.amplifying(function(privates) {
                      return toValue.call(this,
                          taming.tame(privates.feral[prop]));
                    })
            };
            if (fromValue) {
              desc.set = useAttrSetter
                  ? innocuous(function(value) {
                      this.setAttribute(prop, fromValue.call(this, value));
                    })
                  : env.amplifying(function(privates, value) {
                      privates.policy.requireEditable();
                      privates.feral[prop] =
                          taming.untame(fromValue.call(this, value));
                    });
            }
            return desc;
          });
        },
        filterAttr: function(toValue, fromValue) {
          return PT.filter(true, toValue, true, fromValue);
        },
        filterProp: function(toValue, fromValue) {
          return PT.filter(false, toValue, false, fromValue);
        }
      });

      // Node-specific property accessors:
      /**
       * Property descriptor for forwarded properties which have node values
       * and are descendants of this node.
       */
      var NP_tameDescendant = Props.markPropMaker(function(env) {
        var prop = env.prop;
        return {
          enumerable: true,
          get: env.amplifying(function(privates) {
            if (privates.policy.childrenVisible) {
              return defaultTameNode(privates.feral[prop]);
            } else {
              return null;
            }
          })
        };
      });
      function NP_NoArgEditMethod(transform) {
        // TODO(kpreid): Make this into a more general simple-method-taming.
        return Props.markPropMaker(function(env) {
          var prop = env.prop;
          return Props.ampMethod(function noArgEditMethodWrapper(privates) {
            privates.policy.requireEditable();
            return transform(privates.feral[prop]());
          });
        });
      }
      var NP_noArgEditVoidMethod = NP_NoArgEditMethod(noop);
      var NP_noArgEditMethodReturningNode = NP_NoArgEditMethod(defaultTameNode);

      /**
       * Property spec for properties which reflect attributes whose values are
       * not rewritten (so we can use the underlying property on getting) but
       * should, on setting, be restricted by the attribute whitelist.
       */
      // This alias exists so as to document *why* we're doing this particular
      // configuration.
      var NP_writePolicyOnly = PT.filter(false, identity, true, identity);

      var nodeClassNoImplWarnings = {};
      var elementTamerCache = {};
      function makeTameNodeByType(node) {
        switch (node.nodeType) {
          case 1:  // Element
            var rawTagName = node.tagName;
            if (Object.prototype.hasOwnProperty.call(
                elementTamerCache, rawTagName)) {
              return new elementTamerCache[rawTagName](node);
            }
            var tamer;
            var tagName = rawTagName.toLowerCase();
            var schemaElem = htmlSchema.element(tagName);
            if (schemaElem.allowed || tagName === 'script' ||
                tagName === 'style') {
              // <script> and <style> are specifically allowed because we make
              // provisions for controlling their content and script src=.
              var domInterfaceName = schemaElem.domInterface;
              tamer = tamingClassTable.getTamingCtor(domInterfaceName);
              if (!tamer) {
                if (!nodeClassNoImplWarnings[domInterfaceName]) {
                  nodeClassNoImplWarnings[domInterfaceName] = true;
                  if (typeof console !== 'undefined') {
                    console.warn("Domado: " + domInterfaceName + " is not " +
                        "tamed; its specific properties/methods will not be " +
                        "available on <" +
                        htmlSchema.realToVirtualElementName(tagName) + ">.");
                  }
                }
                tamer = TameElement;
              }
            } else {
              // If an unrecognized or unsafe node, return a
              // placeholder that doesn't prevent tree navigation,
              // but that doesn't allow mutation or leak attribute
              // information.
              tamer = TameOpaqueNode;
            }
            elementTamerCache[rawTagName] = tamer;
            return new tamer(node);
          case 2:  // Attr
            // Cannot generically wrap since we must have access to the
            // owner element
            throw 'Internal: Attr nodes cannot be generically wrapped';
          case 3:  // Text
          case 4:  // CDATA Section Node
            return new (tamingClassTable.getTamingCtor('Text'))(node);
          case 8:  // Comment
            return new (tamingClassTable.getTamingCtor('Comment'))(node);
          case 9: // Document (not well supported)
            return new TameBackedNode(node);
          case 11: // Document Fragment
            return new TameBackedNode(node);
          default:
            return new TameOpaqueNode(node);
        }
      }

      /**
       * returns a tame DOM node.
       * @param {Node} node
       * @param {boolean} foreign
       * @see <a href="http://www.w3.org/TR/DOM-Level-2-HTML/html.html"
       *       >DOM Level 2</a>
       */
      function defaultTameNode(node, foreign) {
        if (node === null || node === void 0) { return null; }
        node = makeDOMAccessible(node);
        // TODO(mikesamuel): make sure it really is a DOM node

        if (taming.hasTameTwin(node)) {
          return taming.tame(node);
        }

        if (foreign) {
          vdocContainsForeignNodes = true;
        }

        var tamed = foreign
            ? new TameForeignNode(node)
            : makeTameNodeByType(node);
        tamed = finishNode(tamed);

        return tamed;
      }

      function tameRelatedNode(node) {
        if (node === null || node === void 0) { return null; }
        if (node === containerNode) {
          return tameDocument;
        }

        node = makeDOMAccessible(node);

        // Catch errors because node might be from a different domain.
        try {
          var doc = node.ownerDocument;
          for (var ancestor = node;
              ancestor;
              ancestor = makeDOMAccessible(ancestor.parentNode)) {
            if (isContainerNode(ancestor)) {
              // is within the virtual document
              return defaultTameNode(node);
            } else if (ancestor === doc) {
              // didn't find evidence of being within the virtual document
              return null;
            }
          }
          // permit orphaned nodes
          return defaultTameNode(node);
        } catch (e) {}
        return null;
      }

      /**
       * Is this node a descendant of a foreign node, and therefore to be
       * omitted from node lists?
       */
      function isNodeToBeHidden(feralNode) {
        if (!feralNode) return false;
        for (
            var ancestor = makeDOMAccessible(feralNode.parentNode);
            ancestor !== null;
            ancestor = makeDOMAccessible(ancestor.parentNode)) {
          if (taming.hasTameTwin(ancestor)) {
            if (taming.tame(ancestor) instanceof TameForeignNode) {
              // Every foreign node is already tamed as foreign, by
              // definition.
              return true;
            } else {
              // Reached a node known to be non-foreign.
              return false;
            }
          }
        }
        return false;
      }

      domicile.tameNodeAsForeign = function(node) {
        return defaultTameNode(node, true);
      };

      /**
       * Returns the length of a raw DOM Nodelist object, working around
       * NamedNodeMap bugs in IE, Opera, and Safari as discussed at
       * http://code.google.com/p/google-caja/issues/detail?id=935
       *
       * @param nodeList a DOM NodeList.
       *
       * @return the number of nodes in the NodeList.
       */
      function getNodeListLength(nodeList) {
        var limit = nodeList.length;
        if (limit !== +limit) { limit = 1/0; }
        return limit;
      }

      function nodeListEqualsArray(nodeList, array) {
        var nll = getNodeListLength(nodeList);
        if (nll !== array.length) {
          return false;
        } else {
          for (var i = 0; i < nll; i++) {
            if (nodeList[i] !== array[i]) {
              return false;
            }
          }
          return true;
        }
      }

      // Commentary on foreign node children in NodeLists:
      //
      // The children of a foreign node are an implementation detail which
      // guest code should not be permitted to see. Therefore, we must hide them
      // from appearing in NodeLists. This would be a straightforward matter of
      // filtering, except that NodeLists are "live", reflecting DOM changes
      // immediately; and DOM changes change the membership and numeric indexes
      // of the NodeList.
      //
      // One could imagine caching the outcomes: given an index, scan the host
      // list until the required number of visible-to-guest nodes have been
      // found, cache the indexes and node, and then validate the cache entry
      // later by comparing indexes, but that is not sufficient; consider if a
      // foreign child is deleted, and at the same time a guest-visible node
      // is added in a similar document position; then the index of a guest node
      // which is after that position *should* increase, but this cache cannot
      // tell.
      //
      // Therefore, we do cache the list, but we must re-validate the cache
      // from 0 up to the desired index on every access.
      /**
       * This is NOT a node list taming. This is a component for performing
       * foreign node filtering, and host-exception wrapping, only.
       */
      function NodeListFilter(feralNodeList) {
        feralNodeList = makeDOMAccessible(feralNodeList);
        var expectation = [];
        var filteredCache = [];

        function calcUpTo(index) {
          var feralLength = getNodeListLength(feralNodeList);
          var feralIndex = 0;

          // Validate cache
          if (feralLength < expectation.length) {
            expectation = [];
            filteredCache = [];
            feralIndex = 0;
          } else {
            for (
                ;
                feralIndex < expectation.length && feralIndex < feralLength;
                feralIndex++) {
              if (feralNodeList[feralIndex] !== expectation[feralIndex]) {
                expectation = [];
                filteredCache = [];
                feralIndex = 0;
                break;
              }
            }
          }

          // Extend cache
          nodeListScan: for (
              ;
              feralIndex < feralLength && filteredCache.length <= index;
              feralIndex++) {
            var node = feralNodeList[feralIndex];
            expectation.push(node);
            makeDOMAccessible(node);
            if (!isNodeToBeHidden(node)) {
              filteredCache.push(node);
            }
          }
        }
        // result is not defended, for performance; used only internally.
        return {
          getLength: function() {
            try {
              if (vdocContainsForeignNodes) {
                calcUpTo(Infinity);
                return filteredCache.length;
              } else {
                return getNodeListLength(feralNodeList);
              }
            } catch (e) {
              throw tameException(e);
            }
          },
          item: function(i) {
            try {
              if (vdocContainsForeignNodes) {
                calcUpTo(i);
                return filteredCache[i];
              } else {
                return feralNodeList[i];
              }
            } catch (e) {
              throw tameException(e);
            }
          }
        };
      }

      /**
       * Constructs a NodeList-like object.
       *
       * @param tamed a JavaScript array that will be populated and decorated
       *     with the DOM NodeList API. If it has existing elements they will
       *     precede the actual NodeList elements.
       * @param nodeList an array-like object supporting a "length" property
       *     and "[]" numeric indexing, or a raw DOM NodeList;
       * @param opt_tameNodeCtor a function for constructing tame nodes
       *     out of raw DOM nodes.
       */
      function mixinNodeList(tamed, nodeList, opt_tameNodeCtor) {
        // TODO(kpreid): Under a true ES5 environment, node lists should be
        // proxies so that they preserve liveness of the original lists.
        // This should be controlled by an option.
        // UPDATE: We have live NodeLists as TameNodeList and TameOptionsList.
        // This is not live, but is used in less-mainstream cases.

        var visibleList = new NodeListFilter(nodeList);

        var limit = visibleList.getLength();
        if (limit > 0 && !opt_tameNodeCtor) {
          throw 'Internal: Nonempty mixinNodeList() without a tameNodeCtor';
        }

        for (var i = tamed.length, j = 0;
             j < limit && visibleList.item(j);
             ++i, ++j) {
          tamed[+i] = opt_tameNodeCtor(visibleList.item(+j));
        }

        // Guard against accidental leakage of untamed nodes
        nodeList = visibleList = null;

        tamed.item = cajaVM.constFunc(function(k) {
          k &= 0x7fffffff;
          if (k !== k) { throw new Error(); }
          return tamed[+k] || null;
        });

        return tamed;
      }

      // Used to decide whether to memoize TameNodeList etc. instances.
      var nodeListsAreLive = cajaVM.makeArrayLike.canBeFullyLive;

      // Implementation for DOM live lists (NodeList, etc).
      var arrayLikeCtorUpdaters = [];
      /**
       * @param opt_superCtor If provided, must be itself registered.
       */
      function registerArrayLikeClass(constructor, opt_superCtor) {
        inertCtor(constructor, opt_superCtor || cajaVM.makeArrayLike(0),
            undefined, true);
        var definedPrototype = constructor.prototype;
        // Caller will install properties on this prototype.

        function updater(ArrayLike) {
          // Replace prototype with one inheriting from new ArrayLike.
          inertCtor(constructor, opt_superCtor || ArrayLike, undefined, true);
          var newPrototype = constructor.prototype;
          // Copy properties from old prototype.
          assert(Object.isFrozen(definedPrototype));
          Object.getOwnPropertyNames(definedPrototype).forEach(function(name) {
            if (name === 'constructor') { return; }
            Object.defineProperty(newPrototype, name,
                Object.getOwnPropertyDescriptor(definedPrototype, name));
          });
          // and defend.
          cajaVM.def(newPrototype);
        }
        arrayLikeCtorUpdaters.push(updater);
      }
      function finishArrayLikeClass(constructor) {
        // Cannot def() the constructor because its .prototype is reassigned
        // (and browsers don't let us make it an accessor), so do only the
        // prototype.
        // Cannot def() the prototype because some ArrayLike impls can't be
        // frozen, so do its pieces (except for it's [[Prototype]]).
        var proto = constructor.prototype;
        cajaVM.tamperProof(proto);
        Object.getOwnPropertyNames(proto).forEach(function(prop) {
          if (prop !== 'constructor') {
            // transitively def the value or getter/setter, whichever exists
            cajaVM.def(Object.getOwnPropertyDescriptor(proto, prop));
          }
        });
      }
      function constructArrayLike(ctor, getItem, getLength) {
        var len = +getLength();
        var ArrayLike = cajaVM.makeArrayLike(len);
        if (!(ctor.prototype instanceof ArrayLike)) {
          arrayLikeCtorUpdaters.forEach(function(f) { f(ArrayLike); });
        }
        var instance = ArrayLike(ctor.prototype, getItem, getLength);
        Object.defineProperty(instance, 'item', {
          enumerable: true, // checked against browser
          value: cajaVM.constFunc(getItem)
        });
        return instance;
      }

      function TameNodeList(nodeList, tameNodeCtor, opt_leafCtor) {
        // NodeListFilter takes care of exception wrapping
        var visibleList = new NodeListFilter(nodeList);
        function getItem(i) {
          i = +i;
          if (i >= visibleList.getLength()) { return void 0; }
          return tameNodeCtor(visibleList.item(i));
        }
        var getLength = visibleList.getLength.bind(visibleList);
        var result = constructArrayLike(
            opt_leafCtor || TameNodeList,  // allow inheritance
            getItem, getLength);
        return result;
      }
      registerArrayLikeClass(TameNodeList);
      setToString(TameNodeList.prototype, innocuous(function() {
        return '[domado object NodeList]';
      }));
      finishArrayLikeClass(TameNodeList);

      // NamedNodeMap is a NodeList + live string-named properties; therefore we
      // can't just use ArrayLike.
      var TameNamedNodeMap, namedNodeMapsAreLive;
      if (proxiesAvailable && proxiesInterceptNumeric) {
        namedNodeMapsAreLive = true;
        /**
         * @param {NamedNodeMap} feral
         * @param {function} mapping.tame (feral node in map) -> tame node
         * @param {function} mapping.untameName (guest's view of name) -> host's
         *     view of name (i.e. virtualized)
         * @param {function} mapping.tameGetName (tame node in map) -> node's
         *     name in map
         */
        TameNamedNodeMap = function TameNamedNodeMap1_(feral, mapping) {
          var visibleList = new NodeListFilter(feral);
          Props.define(this, null, {
            length: {
              get: innocuous(visibleList.getLength.bind(visibleList))
            },
            item: {
              value: innocuous(function(i) {
                return mapping.tame(visibleList.item(i));
              })
            }
          });
          Object.freeze(this);
          var proxy = Proxy.create(
              new NamedNodeMapProxyHandler(feral, mapping, visibleList, this),
              Object.getPrototypeOf(this));
          return proxy;
        };
        // TODO(kpreid): Reorder code so exporting the name works
        inertCtor(TameNamedNodeMap, Object /*, 'NamedNodeMap' */);
        setToString(TameNamedNodeMap.prototype, innocuous(function() {
          return '[domado object NamedNodeMap]';
        }));
        cajaVM.def(TameNamedNodeMap);
        var NamedNodeMapProxyHandler = function NamedNodeMapProxyHandler_(
              feral, mapping, visibleList, target) {
          this.feral = feral;
          this.mapping = mapping;
          this.visibleList = visibleList;
          CollectionProxyHandler.call(this, target);
        };
        inherit(NamedNodeMapProxyHandler, CollectionProxyHandler);
        NamedNodeMapProxyHandler.prototype.toString = function() {
          return '[NamedNodeMapProxyHandler]';
        };
        NamedNodeMapProxyHandler.prototype.col_lookup = function(name) {
          if (isNumericName(name)) {
            return this.visibleList.item(+name);
          } else {
            var feral = makeDOMAccessible(this.feral.getNamedItem(
                this.mapping.untameName(name)));
            if (!isNodeToBeHidden(feral)) {
              return feral;
            } else {
              return null;
            }
          }
        };
        NamedNodeMapProxyHandler.prototype.col_evaluate = function(feralNode) {
          return this.mapping.tame(feralNode);
        };
        NamedNodeMapProxyHandler.prototype.col_names = function() {
          // actual browsers don't expose the named properties here, so we don't
          var array = [];
          var n = this.visibleList.getLength();
          for (var i = 0; i < n; i++) {
            array.push(String(i));
          }
          return array;
        };
        cajaVM.def(NamedNodeMapProxyHandler);
      } else {
        namedNodeMapsAreLive = false;
        /**
         * See documentation for other implementation above.
         */
        TameNamedNodeMap = function TameNamedNodeMap2_(feral, mapping) {
          // TODO(kpreid): NamedNodeMap is not normally a subtype of NodeList.
          // I'm just reusing implementation here.
          var self = TameNodeList.call(this, feral, mapping.tame.bind(mapping),
              TameNamedNodeMap);
          for (var i = self.length - 1; i >= 0; i--) {
            var tameNode = self[i];
            Object.defineProperty(self, mapping.tameGetName(tameNode), {
              configurable: false,
              enumerable: false,  // per browser behavior
              writable: false,
              value: tameNode
            });
          }
          Object.freeze(self);
          return self;
        };
        registerArrayLikeClass(TameNamedNodeMap, TameNodeList);
        setToString(TameNamedNodeMap.prototype, innocuous(function() {
          return '[domado object NamedNodeMap]';
        }));
        finishArrayLikeClass(TameNamedNodeMap);
      }

      function TameOptionsList(nodeList, opt_tameNodeCtor) {
        // NodeListFilter takes care of exception wrapping
        var visibleList = new NodeListFilter(nodeList);
        function getItem(i) {
          i = +i;
          return opt_tameNodeCtor(visibleList.item(i));
        }
        var getLength = visibleList.getLength.bind(visibleList);
        var result = constructArrayLike(TameOptionsList, getItem, getLength);
        Object.defineProperty(result, 'selectedIndex', {
            get: innocuous(function() { return +nodeList.selectedIndex; })
          });
        return result;
      }
      registerArrayLikeClass(TameOptionsList);
      setToString(TameOptionsList.prototype, innocuous(function() {
        return '[domado object HTMLOptionsCollection]';
      }));
      finishArrayLikeClass(TameOptionsList);

      /**
       * Return a fake node list containing tamed nodes.
       * @param {Array.<TameNode>} array of tamed nodes.
       * @param {String} typename either 'NodeList' or 'HTMLCollection'
       * @return an array that duck types to a node list.
       */
      function fakeNodeList(array, typename) {
        array.item = innocuous(function(i) { return array[+i]; });
        array.toString = innocuous(
            function() { return '[domado object ' + typename + ']'; });
        return Object.freeze(array);
      }

      /**
       * Constructs an HTMLCollection-like object which indexes its elements
       * based on their NAME attribute.
       *
       * @param tamed a JavaScript array that will be populated and decorated
       *     with the DOM HTMLCollection API.
       * @param nodeList an array-like object supporting a "length" property
       *     and "[]" numeric indexing.
       * @param opt_tameNodeCtor a function for constructing tame nodes
       *     out of raw DOM nodes.
       *
       * TODO(kpreid): Per
       * <http://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-75708506>
       * this should be looking up ids as well as names. (And not returning
       * nodelists, but is that for compatibility?)
       */
      function mixinHTMLCollection(tamed, nodeList, opt_tameNodeCtor) {
        mixinNodeList(tamed, nodeList, opt_tameNodeCtor);

        var tameNodesByName = {};
        var tameNode;

        for (var i = 0; i < tamed.length && (tameNode = tamed[+i]); ++i) {
          var name = void 0;
          if (tameNode.getAttribute) { name = tameNode.getAttribute('name'); }
          if (name && !(name.charAt(name.length - 1) === '_' || (name in tamed)
                       || name === String(name & 0x7fffffff))) {
            if (!tameNodesByName[name]) { tameNodesByName[name] = []; }
            tameNodesByName[name].push(tameNode);
          }
        }

        for (var name in tameNodesByName) {
          var tameNodes = tameNodesByName[name];
          if (tameNodes.length > 1) {
            tamed[name] = fakeNodeList(tameNodes, 'NodeList');
          } else {
            tamed[name] = tameNodes[0];
          }
        }

        tamed.namedItem = cajaVM.constFunc(function(name) {
          name = String(name);
          if (name.charAt(name.length - 1) === '_') {
            return null;
          }
          if (Object.prototype.hasOwnProperty.call(tamed, name)) {
            return cajaVM.passesGuard(TameNodeT, tamed[name])
                ? tamed[name] : tamed[name][0];
          }
          return null;
        });

        return tamed;
      }

      function tameHTMLCollection(nodeList, opt_tameNodeCtor) {
        return Object.freeze(
            mixinHTMLCollection([], nodeList, opt_tameNodeCtor));
      }

      function tameGetElementsByTagName(rootNode, tagName) {
        tagName = String(tagName);
        var eflags = 0;
        if (tagName !== '*') {
          tagName = tagName.toLowerCase();
          tagName = virtualToRealElementName(tagName);
        }
        var feralList = rootNode.getElementsByTagName(tagName);
        if (!taming.hasTameTwin(feralList)) {
          taming.tamesTo(feralList,
              new TameNodeList(feralList, defaultTameNode));
        }
        return taming.tame(feralList);
      }

      /**
       * Implements http://www.whatwg.org/specs/web-apps/current-work/#dom-document-getelementsbyclassname
       * using an existing implementation on browsers that have one.
       */
      function tameGetElementsByClassName(rootNode, className) {
        className = String(className);

        // The quotes below are taken from the HTML5 draft referenced above.

        // "having obtained the classes by splitting a string on spaces"
        // Instead of using split, we use match with the global modifier so that
        // we don't have to remove leading and trailing spaces.
        var classes = className.match(/[^\t\n\f\r ]+/g);

        // Filter out classnames in the restricted namespace.
        for (var i = classes ? classes.length : 0; --i >= 0;) {
          var classi = classes[+i];
          if (FORBIDDEN_ID_PATTERN.test(classi)) {
            classes[+i] = classes[classes.length - 1];
            --classes.length;
          }
        }

        if (!classes || classes.length === 0) {
          // "If there are no tokens specified in the argument, then the method
          //  must return an empty NodeList" [instead of all elements]
          // This means that
          //     htmlEl.ownerDocument.getElementsByClassName(htmlEl.className)
          // will return an HtmlCollection containing htmlElement iff
          // htmlEl.className contains a non-space character.
          return fakeNodeList([], 'NodeList');
        }

        // "unordered set of unique space-separated tokens representing classes"
        if (typeof rootNode.getElementsByClassName === 'function') {
          var feralList = rootNode.getElementsByClassName(classes.join(' '));
          if (!taming.hasTameTwin(feralList)) {
            taming.tamesTo(feralList,
                new TameNodeList(feralList, defaultTameNode));
          }
          return taming.tame(feralList);
        } else {
          // Add spaces around each class so that we can use indexOf later to
          // find a match.
          // This use of indexOf is strictly incorrect since
          // http://www.whatwg.org/specs/web-apps/current-work/#reflecting-content-attributes-in-dom-attributes
          // does not normalize spaces in unordered sets of unique
          // space-separated tokens.  This is not a problem since HTML5
          // compliant implementations already have a getElementsByClassName
          // implementation, and legacy
          // implementations do normalize according to comments on issue 935.

          // We assume standards mode, so the HTML5 requirement that
          //   "If the document is in quirks mode, then the comparisons for the
          //    classes must be done in an ASCII case-insensitive  manner,"
          // is not operative.
          var nClasses = classes.length;
          for (var i = nClasses; --i >= 0;) {
            classes[+i] = ' ' + classes[+i] + ' ';
          }

          // We comply with the requirement that the result is a list
          //   "containing all the elements in the document, in tree order,"
          // since the spec for getElementsByTagName has the same language.
          var candidates = rootNode.getElementsByTagName('*');
          var matches = [];
          var limit = candidates.length;
          if (limit !== +limit) { limit = 1/0; }  // See issue 935
          candidate_loop:
          for (var j = 0, candidate, k = -1;
               j < limit && (candidate = candidates[+j]);
               ++j) {
            var candidateClass = ' ' + candidate.className + ' ';
            for (var i = nClasses; --i >= 0;) {
              if (-1 === candidateClass.indexOf(classes[+i])) {
                continue candidate_loop;
              }
            }
            var tamed = defaultTameNode(candidate);
            if (tamed) {
              matches[++k] = tamed;
            }
          }
          // "the method must return a live NodeList object"
          return fakeNodeList(matches, 'NodeList');
        }
      }

      function tameQuerySelector(rootFeralNode, guestSelector, returnAll) {
        var virtualizedSelectors = sanitizeCssSelectors(
          lexCss(guestSelector),
          idClass,
          tagPolicy);
        var historyInsensitiveVirtualizedSelectors =
          virtualizedSelectors[0].join(',');
        if (returnAll) {
          // TODO(kpreid): Review whether significant performance improvements
          // could be obtained by *not* using our live NodeList emulation, since
          // querySelectorAll is explicitly not live.
          return new TameNodeList(
              rootFeralNode.querySelectorAll(
                  historyInsensitiveVirtualizedSelectors),
              defaultTameNode);
        } else {
          // May return null; defaultTameNode is OK with that.
          return defaultTameNode(
              rootFeralNode.querySelector(
                  historyInsensitiveVirtualizedSelectors));
        }
      }

      /**
       * DOMTokenList taming.
       */
      var TokenListConf = new Confidence('TameDOMTokenList');
      function TameDOMTokenList(feral, getTransform, setTransform) {
        feral = makeDOMAccessible(feral);
        function getItem(i) {
          return TameDOMTokenList.prototype.item.call(self, i);
        }
        function getLength() { return feral.length; }
        var self = constructArrayLike(this.constructor, getItem, getLength);
        TokenListConf.confide(self, taming);
        TokenListConf.amplify(self, function(privates) {
          privates.feral = feral;
          privates.getT = getTransform;
          privates.setT = setTransform;
        });
        return self;
      }
      registerArrayLikeClass(TameDOMTokenList);
      Props.define(TameDOMTokenList.prototype, TokenListConf, {
        length: PT.ro,
        item: Props.ampMethod(function(privates, i) {
          var ftoken = privates.feral.item(i);
          return ftoken === null ? null : privates.getT(ftoken);
        }),
        contains: Props.ampMethod(function(privates, ttoken) {
          var ftoken = privates.setT(String(ttoken));
          if (ftoken === null) { return false; }
          return !!privates.feral.contains(ftoken);
        }),
        add: Props.ampMethod(function(privates, ttoken) {
          var ftoken = privates.setT(String(ttoken));
          if (ftoken === null) { return; }
          privates.feral.add(ftoken);
        }),
        remove: Props.ampMethod(function(privates, ttoken) {
          var ftoken = privates.setT(String(ttoken));
          if (ftoken === null) { return; }
          privates.feral.remove(ftoken);
        }),
        toggle: Props.ampMethod(function(privates, ttoken) {
          var ftoken = privates.setT(String(ttoken));
          if (ftoken === null) { return false; }
          return !!privates.feral.toggle(ftoken);
        }),
        toString: Props.ampMethod(function(privates) {
          return privates.feral.toString().replace(/[^ \t\n\r\f]+/g,
              function(ftoken) {
            var ttoken = privates.getT(ftoken);
            if (ttoken === null) { return ''; }
            return ttoken;
          });
        })
      });
      finishArrayLikeClass(TameDOMTokenList);

      function TameDOMSettableTokenList(feral, getTransform, setTransform) {
        return TameDOMTokenList.call(this, feral, getTransform, setTransform);
      }
      registerArrayLikeClass(TameDOMSettableTokenList, TameDOMTokenList);
      if (elementForFeatureTests.classList && makeDOMAccessible(
          elementForFeatureTests.classList).value !== undefined) {
        Props.define(TameDOMSettableTokenList.prototype, TokenListConf, {
          value: {
            get: TokenListConf.amplifying(function(privates) {
              return privates.feral.value.replace(/[^ \t\n\r\f]+/g,
                    function(s) {
                var ttoken = privates.getT(s);
                if (ttoken === null) { return ''; }
                return ttoken;
              });
            }),
            set: TokenListConf.amplifying(function(privates, val) {
              privates.feral.value = val.replace(/[^ \t\n\r\f]+/g, function(s) {
                var ftoken = privates.setT(s);
                if (ftoken === null) { return ''; }
                return ftoken;
              });
            })
          }
        });
      }
      finishArrayLikeClass(TameDOMSettableTokenList);

      function tameTokenList(feral, getTransform, setTransform) {
        makeDOMAccessible(feral);
        if ('value' in feral) {
          return new TameDOMSettableTokenList(feral, getTransform,
              setTransform);
        } else {
          return new TameDOMTokenList(feral, getTransform, setTransform);
        }
      }

      function makeEventHandlerWrapper(thisNode, listener) {
        ensureValidCallback(listener);
        function wrapper(event) {
          return plugin_dispatchEvent(
              thisNode, event, rulebreaker.getId(tameWindow), listener,
              // indicate that we want an event argument only
              1);
        }
        return wrapper;
      }

      // Implementation of EventTarget::addEventListener
      var tameAddEventListener =
          nodeAmp(function(privates, name, listener, useCapture) {
        name = String(name);
        useCapture = Boolean(useCapture);
        var feral = privates.feral;
        privates.policy.requireEditable();
        var list = privates.wrappedListeners;
        if (!list) {
          list = privates.wrappedListeners = [];
        }
        if (searchForListener(list, name, listener, useCapture) === null) {
          var wrappedListener = makeEventHandlerWrapper(
              privates.feral, listener);
          var remove = bridal.addEventListener(
              privates.feral, name, wrappedListener, useCapture);
          list.push({
            n: name,
            l: listener,
            c: useCapture,
            remove: remove
          });
        }
      });

      // Implementation of EventTarget::removeEventListener
      var tameRemoveEventListener =
          nodeAmp(function(privates, name, listener, useCapture) {
        name = String(name);
        useCapture = Boolean(useCapture);
        var feral = privates.feral;
        privates.policy.requireEditable();
        var list = privates.wrappedListeners;
        if (!list) { return; }
        var match = searchForListener(list, name, listener, useCapture);
        if (match !== null) {
          list[match].remove();
          arrayRemove(list, match, match);
        }
      });

      function searchForListener(list, name, listener, useCapture) {
        for (var i = list.length; --i >= 0;) {
          var record = list[+i];
          if (record.n === name &&
              record.l === listener &&
              record.c === useCapture) {
            return i;
          }
        }
        return null;
      }

      // We have now set up most of the 'support' facilities and are starting to
      // define node taming classes.

      /**
       * Base class for a Node wrapper.  Do not create directly -- use the
       * tameNode factory instead.
       *
       * NOTE that all TameNodes should have the TameNodeT trademark, but it is
       * not applied here since that freezes the object, and also because of the
       * forwarding proxies used for catching expando properties.
       *
       * @param {policy} Mutability policy to apply.
       * @constructor
       */
      function TameNode(policy) {
        TameNodeConf.confide(this, taming);
        if (!policy || !policy.requireEditable) {
          throw new Error("Domado internal error: Policy missing or invalid");
        }
        nodeAmplify(this, function(privates) {
          privates.policy = policy;
        });
        return this;
      }
      inertCtor(TameNode, Object, 'Node');
      Props.define(TameNode.prototype, TameNodeConf, {
        toString: Props.overridable(false, innocuous(function() {
          return nodeToStringSearch(this, this);
        })),
        baseURI: {
          enumerable: true,
          get: innocuous(function() {
            return domicile.pseudoLocation.href;
          })
        },
        ownerDocument: {
          // tameDocument is not yet defined at this point so can't be a
          // constant
          enumerable: true,
          get: innocuous(function() { return tameDocument; })
        }
      });
      /**
       * Print this object according to its tamed class name; also note for
       * debugging purposes if it is actually the prototype instance.
       */
      function nodeToStringSearch(self, prototype) {
        // recursion base case
        if (typeof prototype !== 'object' || prototype === Object.prototype) {
          return Object.prototype.toString.call(self);
        }

        var name = tamingClassTable.getNameOfPrototype(prototype);
        if (!name) {
          // try next ancestor
          return nodeToStringSearch(self, Object.getPrototypeOf(prototype));
        } else if (prototype === self) {
          return '[domado PROTOTYPE OF ' + name + ']';
        } else {
          return '[domado object ' + name + ' ' + self.nodeName + ']';
        }
      }
      // abstract TameNode.prototype.nodeType
      // abstract TameNode.prototype.nodeName
      // abstract TameNode.prototype.nodeValue
      // abstract TameNode.prototype.cloneNode
      // abstract TameNode.prototype.appendChild
      // abstract TameNode.prototype.insertBefore
      // abstract TameNode.prototype.removeChild
      // abstract TameNode.prototype.replaceChild
      // abstract TameNode.prototype.firstChild
      // abstract TameNode.prototype.lastChild
      // abstract TameNode.prototype.nextSibling
      // abstract TameNode.prototype.previousSibling
      // abstract TameNode.prototype.parentNode
      // abstract TameNode.prototype.getElementsByTagName
      // abstract TameNode.prototype.getElementsByClassName
      // abstract TameNode.prototype.childNodes
      // abstract TameNode.prototype.attributes
      cajaVM.def(TameNode);  // and its prototype

      /**
       * A tame node that is backed by a real node.
       *
       * All results of this constructor should be finishNode()d before being
       * revealed.
       *
       * @param {Function} opt_proxyType The constructor of the proxy handler
       *     to use, defaulting to no proxy wrapper.
       * @constructor
       */
      function TameBackedNode(node, opt_policy, opt_proxyType) {
        node = makeDOMAccessible(node);

        if (!node) {
          throw new Error('Creating tame node with undefined native delegate');
        }

        // Determine access policy
        var parent = makeDOMAccessible(node.parentNode);
        var parentPolicy;
        if (!parent || isContainerNode(parent) || isContainerNode(node)) {
          parentPolicy = null;
        } else {
          // Parent is inside the vdoc.
          parentPolicy = nodeAmplify(defaultTameNode(parent),
              function(parentPriv) {
            return parentPriv.policy;
          });
        }
        var policy;
        if (opt_policy) {
          if (parentPolicy) {
            parentPolicy.childPolicy.assertRestrictedBy(opt_policy);
          }
          policy = opt_policy;
          //policy = new TracedNodePolicy(policy, "explicit", null);
        } else if (isContainerNode(parent)) {
          // Virtual document root -- stop implicit recursion and define the
          // root policy. If we wanted to be able to define a "entire DOM
          // read-only" policy, this is where to hook it in.
          policy = nodePolicyEditable;
          //policy = new TracedNodePolicy(policy, "child-of-root", null);
        } else if (parentPolicy) {
          policy = parentPolicy.childPolicy;
          //policy = new TracedNodePolicy(policy,
          //    "childPolicy of " + parent.nodeName, parentPolicy);
        } else {
          policy = nodePolicyEditable;
          //policy = new TracedNodePolicy(policy, "isolated", null);
        }

        TameNode.call(this, policy);

        nodeAmplify(this, function(privates) {
          privates.feral = node;

          if (proxiesAvailable && opt_proxyType) {
            privates.proxyHandler = new opt_proxyType(this);
          }
        });
      }
      inertCtor(TameBackedNode, TameNode);
      var compareDocumentPositionAvailable =
          'function' === typeof elementForFeatureTests.compareDocumentPosition;
      var containsAvailable = elementForFeatureTests.contains;
          // typeof is 'object' on IE
      Props.define(TameBackedNode.prototype, TameNodeConf, {
        nodeType: PT.ro,
        nodeName: PT.ro,
        nodeValue: PT.ro,
        firstChild: NP_tameDescendant, // TODO(kpreid): Must be disableable
        lastChild: NP_tameDescendant,
        nextSibling: PT.related,
        previousSibling: PT.related,
        parentNode: PT.related,
        childNodes: PT.TameMemoIf(nodeListsAreLive, 'childNodes',
            nodeAmp(function(privates, f) {
          if (privates.policy.childrenVisible) {
            return new TameNodeList(f, defaultTameNode);
          } else {
            return fakeNodeList([], 'NodeList');
          }
        })),
        attributes: PT.TameMemoIf(namedNodeMapsAreLive, 'attributes',
            nodeAmp(function(privates, feralMap) {
          if (privates.policy.attributesVisible) {
            var feralOwnerElement = privates.feral;
            return new TameNamedNodeMap(feralMap, {
              tame: function(feralNode) {
                return tameAttributeNode(feralNode, feralOwnerElement);
              },
              tameGetName: function(tameNode) {
                return tameNode.name;
              },
              untameName: function(name) {
                return rewriteAttributeName(feralOwnerElement, name);
              }
            });
          } else {
            // TODO(kpreid): no namedItem interface
            return fakeNodeList([], 'HTMLCollection');
          }
        })),
        cloneNode: Props.ampMethod(function(privates, deep) {
          privates.policy.requireUnrestricted();
          var clone = bridal.cloneNode(privates.feral, Boolean(deep));
          // From http://www.w3.org/TR/DOM-Level-2-Core/core.html#ID-3A0ED0A4
          //   "Note that cloning an immutable subtree results in a mutable copy"
          return defaultTameNode(clone);
        }),
        appendChild: Props.ampMethod(function(privates, child) {
          child = child || {};
          return nodeAmplify(child, function(childPriv) {
            checkAdoption(privates, childPriv);

            privates.feral.appendChild(childPriv.feral);
            return child;
          });
        }),
        insertBefore: Props.ampMethod(function(privates, toInsert, child) {
          if (child === void 0) { child = null; }

          nodeAmplify(toInsert, function(iPriv) {
            checkAdoption(privates, iPriv);
            if (child === null) {
              privates.feral.insertBefore(iPriv.feral, null);
            } else {
              nodeAmplify(child, function(childPriv) {
                privates.feral.insertBefore(iPriv.feral, childPriv.feral);
              });
            }
          });
          return toInsert;
        }),
        removeChild: Props.ampMethod(function(privates, child) {
          nodeAmplify(child, function(childPriv) {
            privates.policy.requireChildrenEditable();
            privates.feral.removeChild(childPriv.feral);
          });
          return child;
        }),
        replaceChild: Props.ampMethod(function(privates, newChild, oldChild) {
          nodeAmplify(newChild, function(newPriv) {
            nodeAmplify(oldChild, function(oldPriv) {
              checkAdoption(privates, newPriv);

              privates.feral.replaceChild(newPriv.feral, oldPriv.feral);
            });
          });
          return oldChild;
        }),
        hasChildNodes: Props.ampMethod(function(privates) {
          if (privates.policy.childrenVisible) {
            return !!privates.feral.hasChildNodes();
          } else {
            return false;
          }
        }),
        // http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-EventTarget
        // "The EventTarget interface is implemented by all Nodes"
        dispatchEvent: Props.ampMethod(function(privates, evt) {
          eventAmplify(evt, function(evtPriv) {
            bridal.dispatchEvent(privates.feral, evtPriv.feral);
          });
        }),
        /**
         * Speced in <a href="http://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-compareDocumentPosition">DOM-Level-3</a>.
         */
        compareDocumentPosition: Props.cond(
            compareDocumentPositionAvailable,
            Props.ampMethod(function(privates, other) {
          if (!other) { return 0; }
          return nodeAmplify(other, function(otherPriv) {
            var otherNode = otherPriv.feral;
            var bitmask = +privates.feral.compareDocumentPosition(otherNode);
            // To avoid leaking information about the relative positioning of
            // different roots, if neither contains the other, then we mask out
            // the preceding/following bits.
            // 0x18 is (CONTAINS | CONTAINED)
            // 0x1f is all the bits documented at
            //   http://www.w3.org/TR/DOM-Level-3-Core/core.html#DocumentPosition
            //   except IMPLEMENTATION_SPECIFIC
            // 0x01 is DISCONNECTED
            /*
            if (!(bitmask & 0x18)) {
              // TODO: If they are not under the same virtual doc root, return
              // DOCUMENT_POSITION_DISCONNECTED instead of leaking information
              // about PRECEDING | FOLLOWING.
            }
            */
            // Firefox3 returns spurious PRECEDING and FOLLOWING bits for
            // disconnected trees.
            // https://bugzilla.mozilla.org/show_bug.cgi?id=486002
            if (bitmask & 1) {
              bitmask &= ~6;
            }
            return bitmask & 0x1f;
          });
        })),
        contains:
            containsAvailable ?
                Props.ampMethod(function(privates, other) {
                  if (other === null || other === void 0) { return false; }
                  return nodeAmplify(other, function(otherPriv) {
                    return privates.feral.contains(otherPriv.feral);
                  });
                }) :
            compareDocumentPositionAvailable ?
                Props.ampMethod(function(other) {
                  // http://www.quirksmode.org/blog/archives/2006/01/contains_for_mo.html
                  if (other === null || other === void 0) { return false; }
                  var docPos = this.compareDocumentPosition(other);
                  return !(!(docPos & 0x10) && docPos);
                }) :
            Props.NO_PROPERTY
      });
      /** Is it OK to make 'child' a child of 'parent'? */
      function checkAdoption(parentPriv, childPriv) {
        // Child must be editable since appendChild can remove it from its
        // parent.
        parentPriv.policy.requireChildrenEditable();
        childPriv.policy.requireEditable();
        // Sanity check: this cannot currently happen but if it does then we
        // need to rethink the calculation of policies.
        parentPriv.policy.childPolicy.assertRestrictedBy(childPriv.policy);
      }
      cajaVM.def(TameBackedNode);  // and its prototype

      // Restricted node types:

      // An opaque node is traversible but not manipulable by guest code. This
      // is the default taming for unrecognized nodes or nodes not explicitly
      // whitelisted.
      function TameOpaqueNode(node) {
        TameBackedNode.call(this, node, nodePolicyOpaque);
      }
      inertCtor(TameOpaqueNode, TameBackedNode);
      cajaVM.def(TameOpaqueNode);

      // A foreign node is one supplied by some external system to the guest
      // code, which the guest code may lay out within its own DOM tree but may
      // not traverse into in any way.
      function TameForeignNode(node) {
        TameBackedNode.call(this, node, nodePolicyForeign);
      }
      inertCtor(TameForeignNode, TameBackedNode);
      Props.define(TameForeignNode.prototype, TameNodeConf, {
        getElementsByTagName: Props.plainMethod(function(tagName) {
          // needed because TameForeignNode doesn't inherit TameElement
          return fakeNodeList([], 'NodeList');
        }),
        getElementsByClassName: Props.plainMethod(function(className) {
          // needed because TameForeignNode doesn't inherit TameElement
          return fakeNodeList([], 'HTMLCollection');
        })
      });
      cajaVM.def(TameForeignNode);

      // Non-element node types:

      tamingClassTable.registerLazy('Text', function() {
        function TameTextNode(node) {
          assert(node.nodeType === 3);
          TameBackedNode.call(this, node);
        }
        inertCtor(TameTextNode, TameBackedNode);
        var textAccessor = Props.actAs('nodeValue', PT.filterProp(identity,
            function(value) { return String(value || ''); }));
        Props.define(TameTextNode.prototype, TameNodeConf, {
          nodeValue: textAccessor,
          textContent: textAccessor,
          innerText: textAccessor,
          data: textAccessor
        });
        return cajaVM.def(TameTextNode);  // and defend its prototype
      });

      tamingClassTable.registerLazy('Comment', function() {
        function TameCommentNode(node) {
          assert(node.nodeType === 8);
          TameBackedNode.call(this, node);
        }
        inertCtor(TameCommentNode, TameBackedNode);
        return cajaVM.def(TameCommentNode);  // and defend its prototype
      });

      // Note that our tame attribute nodes bake in the notion of what element
      // they belong to (in order to implement virtualization policy).
      // Correspondingly, we do not implement createAttribute or
      // setAttributeNode, so it is not possible to associate an attribute with
      // a different element.
      //
      // In the event that we need to change this, note that not all browsers
      // implement .ownerElement on attribute nodes, and that there is currently
      // (2013-02-26) an effort to deprecate attributes-as-nodes, according to
      // MDN <https://developer.mozilla.org/en-US/docs/DOM/Attr>.
      function tameAttributeNode(node, ownerElement) {
        if (node === null || node === undefined) {
          return node;
        } else if (taming.hasTameTwin(node)) {
          return taming.tame(node);
        } else {
          var self = new (tamingClassTable.getTamingCtor('Attr'))(
              node, ownerElement);
          taming.tamesTo(node, self);
          return self;
        }
      }
      tamingClassTable.registerLazy('Attr', function() {
        function TameBackedAttributeNode(node, ownerElement) {
          node = makeDOMAccessible(node);
          if ('ownerElement' in node && node.ownerElement !== ownerElement) {
            throw new Error('Inconsistent ownerElement');
          }

          var ownerPolicy = nodeAmplify(defaultTameNode(ownerElement),
              function(ownerPriv) {
            return ownerPriv.policy;
          });

          TameBackedNode.call(this, node, ownerPolicy);

          nodeAmplify(this, function(privates) {
            privates.ownerElement = ownerElement;
          });
        }
        inertCtor(TameBackedAttributeNode, TameBackedNode);
        var nameAccessor = PT.ROView(function(name) {
          if (cajaPrefRe.test(name)) {
            name = name.substring(cajaPrefix.length);
          }
          return name;
        });
        var valueAccessor = {
          enumerable: true,
          get: innocuous(function() {
             return this.ownerElement.getAttribute(this.name);
          }),
          set: innocuous(function(value) {
            return this.ownerElement.setAttribute(this.name, value);
          })
        };
        var notImplementedNodeMethod = {
          enumerable: true,
          value: innocuous(function() {
            throw new Error('Not implemented.');
          })
        };
        Props.define(TameBackedAttributeNode.prototype, TameNodeConf, {
          nodeName: nameAccessor,
          name: nameAccessor,
          specified: {
            enumerable: true,
            get: innocuous(function() {
              return this.ownerElement.hasAttribute(this.name);
            })
          },
          nodeValue: valueAccessor,
          value: valueAccessor,
          ownerElement: {
            enumerable: true,
            get: nodeAmp(function(privates) {
              return defaultTameNode(privates.ownerElement);
            })
          },
          nodeType: P_constant(2),
          firstChild:      P_UNIMPLEMENTED,
          lastChild:       P_UNIMPLEMENTED,
          nextSibling:     P_UNIMPLEMENTED,
          previousSibling: P_UNIMPLEMENTED,
          parentNode:      P_UNIMPLEMENTED,
          childNodes:      P_UNIMPLEMENTED,
          attributes:      P_UNIMPLEMENTED,
          cloneNode: Props.ampMethod(function(privates, deep) {
            var clone = bridal.cloneNode(privates.feral, Boolean(deep));
            // From http://www.w3.org/TR/DOM-Level-2-Core/core.html#ID-3A0ED0A4
            //   "Note that cloning an immutable subtree results in a mutable
            //    copy"
            return tameAttributeNode(clone, privates.ownerElement);
          }),
          appendChild: notImplementedNodeMethod,
          insertBefore: notImplementedNodeMethod,
          removeChild: notImplementedNodeMethod,
          replaceChild: notImplementedNodeMethod
        });
        return cajaVM.def(TameBackedAttributeNode);  // and defend its prototype
      });

      // Register set handlers for onclick, onmouseover, etc.
      function registerElementScriptAttributeHandlers(tameElementPrototype) {
        var seenAlready = {};
        var attrNameRe = /::(.*)/;
        for (var html4Attrib in html4.ATTRIBS) {
          if (html4.atype.SCRIPT === html4.ATTRIBS[html4Attrib]) {
            (function (attribName) {
              // Attribute names are defined per-element, so we will see
              // duplicates here.
              if (Object.prototype.hasOwnProperty.call(
                  seenAlready, attribName)) {
                return;
              }
              seenAlready[attribName] = true;

              Object.defineProperty(tameElementPrototype, attribName, {
                enumerable: canHaveEnumerableAccessors,
                configurable: false,
                set: nodeAmp(function eventHandlerSetter(privates, listener) {
                  privates.policy.requireEditable();
                  if (!listener) {  // Clear the current handler
                    privates.feral[attribName] = null;
                  } else {
                    // This handler cannot be copied from one node to another
                    // which is why getters are not yet supported.
                    privates.feral[attribName] = makeEventHandlerWrapper(
                        privates.feral, listener);
                  }
                  return listener;
                })
              });
            })(html4Attrib.match(attrNameRe)[1]);
          }
        }
      }

      // Elements in general and specific elements:

      // TODO(kpreid): See if it's feasible to make TameElement lazy constructed
      // for guests that don't do any DOM manipulation until after load. Will
      // require deferring the tameContainerNode.
      /**
       * @constructor
       */
      function TameElement(node, opt_policy, opt_proxyType) {
        assert(node.nodeType === 1);
        TameBackedNode.call(this, node, opt_policy, opt_proxyType);
        nodeAmplify(this, function(privates) {
          privates.geometryDelegate = node;
          privates.wrappedListeners = undefined;
        });
      }
      var defaultNodeClassCtor =
          tamingClassTable.registerSafeCtor('Element',
              inertCtor(TameElement, TameBackedNode, 'HTMLElement'));
      registerElementScriptAttributeHandlers(TameElement.prototype);
      function innerTextOf(rawNode, out) {
        switch (rawNode.nodeType) {
          case 1:  // Element
            if (htmlSchema.element(rawNode.tagName).allowed) {
              // Not an opaque node.
              for (var c = rawNode.firstChild; c; c = c.nextSibling) {
                c = makeDOMAccessible(c);
                innerTextOf(c, out);
              }
            }
            break;
          case 3:  // Text Node
          case 4:  // CDATA Section Node
            out[out.length] = rawNode.data;
            break;
          case 11:  // Document Fragment
            for (var c = rawNode.firstChild; c; c = c.nextSibling) {
              c = makeDOMAccessible(c);
              innerTextOf(c, out);
            }
            break;
        }
      }
      var geometryDelegateProperty = Props.markPropMaker(function(env) {
        var prop = env.prop;
        return {
          enumerable: true,
          get: env.amplifying(function(privates) {
            return +privates.geometryDelegate[prop];
          })
        };
      });
      var geometryDelegatePropertySettable = Props.markPropMaker(function(env) {
        var desc = geometryDelegateProperty(env);
        var prop = env.prop;
        desc.set = env.amplifying(function(privates, value) {
          privates.policy.requireEditable();
          privates.geometryDelegate[prop] = +value;
        });
        return desc;
      });
      var textContentProp = {
        enumerable: true,
        get: nodeAmp(function(privates) {
          var text = [];
          innerTextOf(privates.feral, text);
          return text.join('');
        }),
        set: nodeAmp(function(privates, newText) {
          // This operation changes the child node list (but not other
          // properties of the element) so it checks childrenEditable. Note that
          // this check is critical to security, as else a client can set the
          // textContent of a <script> element to execute scripts.
          privates.policy.requireChildrenEditable();
          var newTextStr = newText != null ? String(newText) : '';
          var el = privates.feral;
          for (var c; (c = el.firstChild);) { el.removeChild(c); }
          if (newTextStr) {
            el.appendChild(el.ownerDocument.createTextNode(newTextStr));
          }
        })
      };
      var tagNameAttr = PT.ROView(function(name) {
        return realToVirtualElementName(String(name));
      });
      Props.define(TameElement.prototype, TameNodeConf, {
        id: PT.filterAttr(defaultToEmptyStr, identity),
        className: {
          enumerable: true,
          get: innocuous(function() {
            return this.getAttribute('class') || '';
          }),
          set: innocuous(function(classes) {
            return this.setAttribute('class', String(classes));
          })
        },
        title: PT.filterAttr(defaultToEmptyStr, String),
        dir: PT.filterAttr(defaultToEmptyStr, String),
        textContent: textContentProp,
        innerText: textContentProp,
        // Note: Per MDN, innerText is actually subtly different than
        // textContent, in that innerText does not include text hidden via
        // styles, per MDN. We do not implement this difference.
        nodeName: tagNameAttr,
        tagName: tagNameAttr,
        style: {
          enumerable: true,
          get: nodeAmp(function(privates) {
            return new (tamingClassTable.getTamingCtor('CSSStyleDeclaration'))(
                privates.feral.style, privates.policy.editable, this);
          }),
          set: innocuous(function(value) {
            this.setAttribute('style', value);
          })
        },
        innerHTML: {
          enumerable: true,
          get: innocuous(function() {
            return htmlFragmentSerialization(this);
          }),
          set: nodeAmp(function(privates, htmlFragment) {
            // This operation changes the child node list (but not other
            // properties of the element) so it checks childrenEditable. Note
            // that this check is critical to security, as else a client can set
            // the innerHTML of a <script> element to execute scripts.
            privates.policy.requireChildrenEditable();
            var node = privates.feral;
            var schemaElem = htmlSchema.element(node.tagName);
            if (!schemaElem.allowed) {
              throw new Error("Can't set .innerHTML of non-whitelisted <" +
                  node.tagName + ">");
            }
            var isRCDATA = schemaElem.contentIsRCDATA;
            var htmlFragmentString;
            if (htmlFragment === null) {
              htmlFragmentString = '';
            } else {
              htmlFragmentString = '' + htmlFragment;
            }
            var sanitizedHtml;
            if (isRCDATA) {
              sanitizedHtml = html.normalizeRCData(htmlFragmentString);
            } else {
              sanitizedHtml = sanitizeHtml(htmlFragmentString);
            }
            node.innerHTML = sanitizedHtml;
          })
        },
        offsetParent: {
          enumerable: true,
          get: nodeAmp(function(privates) {
            var feralOffsetParent = privates.feral.offsetParent;
            if (!feralOffsetParent) {
              return feralOffsetParent;
            } else if (feralOffsetParent === containerNode) {
              // Return the body if the node is contained in the body. This is
              // emulating how browsers treat offsetParent and the real <BODY>.
              return nodeAmplify(tameDocument.body, function(bodyPriv) {
                var feralBody = bodyPriv.feral;
                for (var ancestor =
                         makeDOMAccessible(privates.feral.parentNode);
                     ancestor !== containerNode;
                     ancestor = makeDOMAccessible(ancestor.parentNode)) {
                  if (ancestor === feralBody) {
                    return defaultTameNode(feralBody);
                  }
                }
                return null;
              });
            } else {
              return tameRelatedNode(feralOffsetParent);
            }
          })
        },
        accessKey: PT.rw,
        tabIndex: PT.rw,
        clientLeft: geometryDelegateProperty,
        clientTop: geometryDelegateProperty,
        clientWidth: geometryDelegateProperty,
        clientHeight: geometryDelegateProperty,
        offsetLeft: geometryDelegateProperty,
        offsetTop: geometryDelegateProperty,
        offsetWidth: geometryDelegateProperty,
        offsetHeight: geometryDelegateProperty,
        scrollLeft: geometryDelegatePropertySettable,
        scrollTop: geometryDelegatePropertySettable,
        scrollWidth: geometryDelegateProperty,
        scrollHeight: geometryDelegateProperty,
        blur: NP_noArgEditVoidMethod,
        focus: Props.ampMethod(function(privates) {
          return domicile.handlingUserAction && privates.feral.focus();
        }),
        // IE-specific method.  Sets the element that will have focus when the
        // window has focus, without focusing the window.
        setActive: Props.cond(elementForFeatureTests.setActive,
            Props.ampMethod(function(privates) {
              return domicile.handlingUserAction && privates.feral.setActive();
            })),
        // IE-specific method.
        hasFocus: Props.cond(elementForFeatureTests.hasFocus,
            Props.ampMethod(function(privates) {
              return privates.feral.hasFocus();
            })),
        getAttribute: Props.ampMethod(function(privates, attribName) {
          if (!privates.policy.attributesVisible) { return null; }
          var feral = privates.feral;
          attribName = String(attribName).toLowerCase();
          if (/__$/.test(attribName)) {
            throw new TypeError('Attributes may not end with __');
          }
          var tagName = feral.tagName.toLowerCase();
          var atype = htmlSchema.attribute(tagName, attribName).type;
          if (atype === void 0) {
            return feral.getAttribute(cajaPrefix + attribName);
          }
          var value = bridal.getAttribute(feral, attribName);
          if ('string' !== typeof value) { return value; }
          return virtualizeAttributeValue(atype, value);
        }),
        getAttributeNode: Props.ampMethod(function(privates, name) {
          if (!privates.policy.attributesVisible) { return null; }
          var feral = privates.feral;
          return tameAttributeNode(
              feral.getAttributeNode(rewriteAttributeName(feral, name)),
              feral);
        }),
        hasAttribute: Props.ampMethod(function(privates, attribName) {
          var feral = privates.feral;
          return bridal.hasAttribute(feral,
              rewriteAttributeName(feral, attribName));
        }),
        setAttribute: Props.ampMethod(function(privates, attribName, value) {
          var feral = privates.feral;
          privates.policy.requireEditable();
          attribName = String(attribName).toLowerCase();
          if (/__$/.test(attribName)) {
            throw new TypeError('Attributes may not end with __');
          }
          if (!privates.policy.attributesVisible) { return null; }
          var tagName = feral.tagName.toLowerCase();
          var atype = htmlSchema.attribute(tagName, attribName).type;
          if (atype === void 0) {
            bridal.setAttribute(feral, cajaPrefix + attribName, value);
          } else {
            var sanitizedValue = rewriteAttribute(
                tagName, attribName, atype, value);
            if (sanitizedValue !== null) {
              bridal.setAttribute(feral, attribName, sanitizedValue);
              if (html4.ATTRIBS.hasOwnProperty(tagName + '::target') &&
                atype === html4.atype.URI) {
                if (sanitizedValue.charAt(0) === '#') {
                  feral.removeAttribute('target');
                } else {
                  bridal.setAttribute(feral, 'target',
                    getSafeTargetAttribute(tagName, 'target',
                      bridal.getAttribute(feral, 'target')));
                }
              }
            } else {
              if (typeof console !== 'undefined') {
                console.warn('Rejecting <' + tagName + '>.setAttribute(',
                    attribName, ',', value, ')');
              }
            }
          }
          return value;
        }),
        removeAttribute: Props.ampMethod(function(privates, attribName) {
          var feral = privates.feral;
          privates.policy.requireEditable();
          feral.removeAttribute(rewriteAttributeName(feral, attribName));
        }),
        getElementsByTagName: Props.ampMethod(function(privates, tagName) {
          return tameGetElementsByTagName(privates.feral, tagName);
        }),
        getElementsByClassName: Props.ampMethod(function(privates, className) {
          return tameGetElementsByClassName(privates.feral, className);
        }),
        querySelector: Props.cond(elementForFeatureTests.querySelector,
            Props.ampMethod(function(privates, selector) {
              return tameQuerySelector(privates.feral, selector, false);
            })),
        querySelectorAll: Props.cond(elementForFeatureTests.querySelectorAll,
            Props.ampMethod(function(privates, selector) {
              return tameQuerySelector(privates.feral, selector, true);
            })),
        getBoundingClientRect: Props.ampMethod(function(privates) {
          var elRect = bridal.getBoundingClientRect(privates.feral);
          return nodeAmplify(this.ownerDocument, function(docPriv) {
            var vdoc = bridal.getBoundingClientRect(docPriv.feralContainerNode);
            var vdocLeft = vdoc.left, vdocTop = vdoc.top;
            return ({
                      top: elRect.top - vdocTop,
                      left: elRect.left - vdocLeft,
                      right: elRect.right - vdocLeft,
                      bottom: elRect.bottom - vdocTop
                    });
          });
        }),
        addEventListener: Props.overridable(true, tameAddEventListener),
        removeEventListener: Props.overridable(true, tameRemoveEventListener)
      });
      if ('classList' in elementForFeatureTests) {
        Props.define(TameElement.prototype, TameNodeConf, {
          classList: PT.TameMemoIf(true, 'classList',
                         nodeAmp(function(privates, feralList) {
            var element = this;
            return new TameDOMSettableTokenList(feralList,
                function classListGetTransform(token) {
                  return virtualizeAttributeValue(html4.atype.CLASSES, token);
                },
                function classListSetTransform(token) {
                  return rewriteAttribute(element.tagName, 'class',
                      html4.atype.CLASSES, token);
                });
          }))
        });
      }
      cajaVM.def(TameElement);  // and its prototype

      /**
       * Define a taming class for a subclass of HTMLElement.
       *
       * @param {function|string} record.superclass The tame superclass
       *     constructor (defaults to TameElement) with parameters (this, node,
       *     policy, opt_proxyType). May be specified as a string which will be
       *     looked up in the tamingClassTable.
       * @param {Array} record.names The element names which should be tamed
       *     using this class.
       * @param {string} record.domClass The DOM-specified class name.
       * @param {function} record.properties A function returning the custom
       *     properties this class should have (in the format accepted by
       *     Props.define). (Is a function for laziness.)
       * @param {function} record.construct Code to invoke at the end of
       *     construction; takes and returns self.
       * @param {?boolean} record.virtualized Whether it should be expected that
       *     elements tamed with this class should have virtualized names.
       *     If null, no restriction.
       * @param {boolean} record.forceChildrenNotEditable Whether to force the
       *     child node list and child nodes to not be mutable.
       */
      function defineElement(record) {
        var domClass = record.domClass;
        if (!domClass) {
          throw new Error('Anonymous element classes are useless');
        }
        var superclassRef = record.superclass || 'HTMLElement';
        var proxyType = record.proxyType;
        var construct = record.construct || identity;
        var shouldBeVirtualized = "virtualized" in record
            ? record.virtualized : false;
        var opt_policy = record.forceChildrenNotEditable
            ? nodePolicyReadOnlyChildren : null;
        function defineElementThunk() {
          var superclass = typeof superclassRef === 'string'
              ? tamingClassTable.getTamingCtor(superclassRef)
              : superclassRef;
          function TameSpecificElement(node) {
            if (shouldBeVirtualized !== null) {
              var isVirtualized =
                  htmlSchema.isVirtualizedElementName(node.tagName);
              if (!isVirtualized !== !shouldBeVirtualized) {
                throw new Error('Domado internal inconsistency: ' + node.tagName
                    + ' has inconsistent virtualization state with class ' +
                    record.domClass);
              }
            }
            superclass.call(this, node, opt_policy, proxyType);
            construct.call(this);
          }
          inertCtor(TameSpecificElement, superclass);
          if (record.properties) {
            Props.define(TameSpecificElement.prototype, TameNodeConf,
                (0,record.properties)());
          }
          // Note: cajaVM.def will be applied to all registered node classes
          // later, so users of defineElement don't need to.
          return cajaVM.def(TameSpecificElement);
        }
        tamingClassTable.registerLazy(domClass, defineElementThunk);
      }
      cajaVM.def(defineElement);
      
      /**
       * For elements which have no properties at all, but we want to define in
       * in order to be explicitly complete (suppress the no-implementation
       * warning).
       */
      function defineTrivialElement(domClass) {
        defineElement({domClass: domClass});
      }

      defineElement({
        domClass: 'HTMLAnchorElement',
        properties: function() { return {
          hash: PT.filter(
            false,
            function (value) { return unsuffix(value, idSuffix, value); },
            false,
            // TODO(felix8a): add suffix if href is self
            identity),
          // TODO(felix8a): fragment rewriting?
          href: NP_writePolicyOnly
        }; }
      });

      defineElement({
        superclass: 'HTMLMediaElement',
        domClass: 'HTMLAudioElement'
      });
      namedConstructors.Audio = innocuous(function AudioCtor(src) {
        var element = tameDocument.createElement('audio');
        element.preload = 'auto';
        if (src !== undefined) { element.src = src; }
        return element;
      });

      defineTrivialElement('HTMLBRElement');

      defineElement({
        virtualized: true,
        domClass: 'HTMLBodyElement',
        properties: function() { return {
          setAttribute: Props.overridable(true, innocuous(
              function(attrib, value) {
            TameElement.prototype.setAttribute.call(this, attrib, value);
            var attribName = String(attrib).toLowerCase();
            // Window event handlers are exposed as content attributes on <body>
            // and <frameset>
            // <http://www.whatwg.org/specs/web-apps/current-work/multipage/webappapis.html#handler-window-onload>
            // as of 2012-09-14
            // Note: We only currently implement onload.
            if (attribName === 'onload') {
              // We do not use the main event-handler-attribute rewriter here
              // because it generates event-handler strings, not functions --
              // and for the TameWindow there is no real element to hang those
              // handler strings on. TODO(kpreid): refactor to fix that.
              if (cajaVM.compileExpr) { // ES5 case: eval available
                // Per http://www.whatwg.org/specs/web-apps/current-work/multipage/webappapis.html#event-handler-attributes
                tameWindow[attribName] = cajaVM.compileExpr(
                    'function cajaEventHandlerAttribFn_' + attribName +
                    '(event) {\n' + value + '\n}')(tameWindow);
              } else {
                var match = value.match(SIMPLE_HANDLER_PATTERN);
                if (!match) { return; }
                //var doesReturn = match[1];  // not currently used
                var fnName = match[2];
                // TODO(kpreid): Synthesize a load event object.
                // Select appropriate arguments
                var wrapper;
                if (match[3] !== undefined) {
                  wrapper = function() {
                      tameWindow[fnName].call(this, {}, this); };
                } else if (match[2] !== undefined) {
                  wrapper = function() {
                    tameWindow[fnName].call(this, {}); };
                } else {
                  wrapper = function() {
                    tameWindow[fnName].call(this); };
                }
                tameWindow[attribName] = wrapper;
              }
            }
          }))
        }; }
      });

      // http://dev.w3.org/html5/spec/Overview.html#the-canvas-element
      (function() {
        // TODO(felix8a): need to call bridal.initCanvasElement
        var canvasTest = makeDOMAccessible(document.createElement('canvas'));
        if (typeof canvasTest.getContext !== 'function') {
          // If the host browser does not have getContext, then it must not
          // usefully support canvas, so we don't either; skip registering the
          // canvas element class.
          return;
        }

        // TODO(kpreid): snitched from Caja runtime; review whether we actually
        // need this (the Canvas spec says that invalid values should be ignored
        // and we don't do that in a bunch of places);
        /**
         * Enforces <tt>typeOf(specimen) === typename</tt>, in which case
         * specimen is returned.
         * <p>
         * If not, throws an informative TypeError
         * <p>
         * opt_name, if provided, should be a name or description of the
         * specimen used only to generate friendlier error messages.
         */
        function enforceType(specimen, typename, opt_name) {
          if (typeof specimen !== typename) {
            throw new Error('expected ' + typename + ' instead of ' +
                typeof specimen + ': ' + (opt_name || specimen));
          }
          return specimen;
        }

        function matchesStyleFully(cssPropertyName, value) {
          if (typeof value !== "string") { return false; }
          var tokens = lexCss(value);
          var k = 0;
          for (var i = 0, n = tokens.length; i < n; ++i) {
            var tok = tokens[i];
            if (tok !== ' ') { tokens[k++] = tok; }
          }
          tokens.length = k;
          // sanitizeCssProperty always lowercases
          var unfiltered = tokens.join(' ').toLowerCase();
          sanitizeCssProperty(cssPropertyName,
                              cssSchema[cssPropertyName], tokens);
          return unfiltered === tokens.join(' ') ? unfiltered : false;
        }

        function isFont(value) {
          return !!matchesStyleFully('font', value);
        }
        function isColor(value) {
          // Note: we're testing against the pattern for the CSS "color:"
          // property, but what is actually referenced by the draft canvas spec
          // is
          // the CSS syntactic element <color>, which is why we need to
          // specifically exclude "inherit".
          var style = matchesStyleFully('color', value);
          return style && style.toLowerCase() !== 'inherit';
        }
        var colorNameTable = {
          // http://dev.w3.org/csswg/css3-color/#html4 as cited by
          // http://dev.w3.org/html5/2dcontext/#dom-context-2d-fillstyle
          // TODO(kpreid): avoid duplication with table in CssRewriter.java
          " black":   "#000000",
          " silver":  "#c0c0c0",
          " gray":    "#808080",
          " white":   "#ffffff",
          " maroon":  "#800000",
          " red":     "#ff0000",
          " purple":  "#800080",
          " fuchsia": "#ff00ff",
          " green":   "#008000",
          " lime":    "#00ff00",
          " olive":   "#808000",
          " yellow":  "#ffff00",
          " navy":    "#000080",
          " blue":    "#0000ff",
          " teal":    "#008080",
          " aqua":    "#00ffff"
        };
        function StringTest(strings) {
          var table = {};
          // The table itself as a value is a marker to avoid running into
          // Object.prototype properties.
          for (var i = strings.length; --i >= 0;) {
            table[strings[+i]] = table;
          }
          return cajaVM.constFunc(function(string) {
            return typeof string === 'string' && table[string] === table;
          });
        }
        function canonColor(colorString) {
          // http://dev.w3.org/html5/2dcontext/ says the color shall be returned
          // only as #hhhhhh, not as names.
          return colorNameTable[" " + colorString] || colorString;
        }
        
        tamingClassTable.registerLazy('ImageData', function() {
          function TameImageData(imageData) {
            imageData = makeDOMAccessible(imageData);

            // Since we can't interpose indexing, we can't wrap the
            // CanvasPixelArray
            // so we have to copy the pixel data. This is horrible, bad, and
            // awful.
            // TODO(kpreid): No longer true in ES5-land; we can interpose but
            // not under ES5/3. Use proxies conditional on the same switch that
            // controls liveness of node lists.

            TameImageDataConf.confide(this, taming);
            taming.permitUntaming(this);

            this.width = Number(imageData.width);
            this.height = Number(imageData.height);

            TameImageDataConf.amplify(this, function(privates) {
              // used to unwrap for passing to putImageData
              privates.feral = imageData;

              // lazily constructed tame copy, backs .data accessor; also used
              // to test whether we need to write-back the copy before a
              // putImageData
              privates.tamePixelArray = undefined;

              Object.preventExtensions(privates);
            });
            Object.freeze(this);
          }
          inertCtor(TameImageData, Object);
          Props.define(TameImageData.prototype, TameImageDataConf, {
            toString: Props.overridable(false, innocuous(function() {
              return '[domado object ImageData]';
            })),
            // Accessor used so we don't need to copy if the client is
            // just blitting (getImageData -> putImageData) rather than
            // inspecting the pixels.
            data: Props.ampGetter(function(privates) {
              if (!privates.tamePixelArray) {

                var bareArray = privates.feral.data;
                // Note: On Firefox 4.0.1, at least, pixel arrays cannot
                // have added properties (such as our w___). Therefore,
                // for writing, we use a special routine, and we don't do
                // makeDOMAccessible because it would have no effect. An
                // alternative approach would be to muck with the
                // "Uint8ClampedArray" prototype.

                var length = bareArray.length;
                var tamePixelArray = { // not frozen, user-modifiable
                  // TODO: Investigate whether it would be an optimization
                  // to make this an array with properties added.
                  toString: innocuous(function() {
                    return '[domado object CanvasPixelArray]';
                  }),
                  _d_canvas_writeback: innocuous(function() {
                    // This is invoked just before each putImageData

                    // TODO(kpreid): shouldn't be a public method (but is
                    // harmless).

                    rulebreaker.writeToPixelArray(
                      tamePixelArray, bareArray, length);
                  })
                };
                for (var i = length-1; i >= 0; i--) {
                  tamePixelArray[+i] = bareArray[+i];
                }
                privates.tamePixelArray = tamePixelArray;
              }
              return privates.tamePixelArray;
            })
          });
          return cajaVM.def(TameImageData);
        });

        tamingClassTable.registerLazy('CanvasGradient', function() {
          function TameGradient(gradient) {
            TameGradientConf.confide(this, taming);
            TameGradientConf.amplify(this, function(privates) {
              privates.feral = makeDOMAccessible(gradient);
            });
            taming.tamesTo(gradient, this);
            Object.freeze(this);
          }
          inertCtor(TameGradient, Object);
          Props.define(TameGradient.prototype, TameGradientConf, {
            toString: Props.plainMethod(function() {
               return '[domado object CanvasGradient]';
            }),
            addColorStop: tameMethodCustom(function(privates, offset, color) {
              enforceType(offset, 'number', 'color stop offset');
              if (!(0 <= offset && offset <= 1)) {
                throw new Error(INDEX_SIZE_ERROR);
                // TODO(kpreid): should be a DOMException per spec
              }
              if (!isColor(color)) {
                throw new Error('SYNTAX_ERR');
                // TODO(kpreid): should be a DOMException per spec
              }
              privates.feral.addColorStop(offset, color);
            })
          });
          return cajaVM.def(TameGradient);
        });

        function enforceFinite(value, name) {
          enforceType(value, 'number', name);
          if (!isFinite(value)) {
            throw new Error("NOT_SUPPORTED_ERR");
            // TODO(kpreid): should be a DOMException per spec
          }
        }

        // Design note: We generally reject the wrong number of arguments,
        // unlike default JS behavior. This is because we are just passing data
        // through to the underlying implementation, but we don't want to pass
        // on anything which might be an extension we don't know about, and it
        // is better to fail explicitly than to leave the client wondering about
        // why their extension usage isn't working.
        //
        // TODO(kpreid): I no longer think this is a good idea; it deviates from
        // JavaScript conventions and increases code complexity, and requires
        // distinct taming wrappers from the rest of Domado. Remove all of the
        // argument length checking and simultaneously use conformant
        // coerce/ignore behavior for NaN and non-floats rather than strict
        // type checks.

        // TODO(kpreid): Consolidate this with tameNoArgEditMethod and friends.
        var tameNoArgOp = Props.markPropMaker(function (env) {
          var prop = env.prop;
          return {
            enumerable: true,
            value: env.amplifying(function(privates) {
              if (arguments.length !== 1) {
                throw new Error(prop + ' takes no args, not ' +
                    (arguments.length - 1));
              }
              privates.feral[prop]();
            })
          };
        });

        function tameFloatsOp(count) {
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            return {
              enumerable: true,
              value: env.amplifying(function(privates) {
                if (arguments.length - 1 !== count) {
                  throw new Error(prop + ' takes ' + count +
                      ' args, not ' + (arguments.length - 1));
                }
                var args = new Array(count);
                for (var i = 0; i < count; i++) {
                  args[+i] = enforceType(arguments[+i + 1], 'number',
                      prop + ' argument ' + i);
                }
                // The copy-into-array is necessary in ES5/3 because host DOM
                // won't take an arguments object from inside of ES53.
                var feral = privates.feral;
                // TODO(kpreid): Needing to do this not good. A normal mDA isn't
                // sufficient because we're using .apply for varargs
                makeDOMAccessible(feral[prop]).apply(feral, args);
              })
            };
          });
        }

        function tameRectMethod(resultFn) {
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            return {
              enumerable: true,
              value: env.amplifying(function(privates, x, y, w, h) {
                if (arguments.length !== 5) {
                  throw new Error(prop + ' takes 4 args, not ' +
                                  (arguments.length - 1));
                }
                enforceType(x, 'number', 'x');
                enforceType(y, 'number', 'y');
                enforceType(w, 'number', 'width');
                enforceType(h, 'number', 'height');
                return resultFn(privates.feral[prop](x, y, w, h));
              })
            };
          });
        }

        var tameDrawText = Props.markPropMaker(function(env) {
          var prop = env.prop;
          return {
            enumerable: true,
            value: env.amplifying(function(
                privates, text, x, y, maxWidth) {
              enforceType(text, 'string', 'text');
              enforceType(x, 'number', 'x');
              enforceType(y, 'number', 'y');
              switch (arguments.length - 1) {
              case 3:
                privates.feral[prop](text, x, y);
                return;
              case 4:
                enforceType(maxWidth, 'number', 'maxWidth');
                privates.feral[prop](text, x, y, maxWidth);
                return;
              default:
                throw new Error(prop + ' cannot accept ' +
                    (arguments.length - 1) + ' arguments');
              }
            })
          };
        });

        // TODO(kpreid): Consolidate this with tameNoArgEditMethod and friends.
        function tameMethodCustom(baseFunc, dontCheckLength) {
          var expectedLength = baseFunc.length - 1; // remove 'privates' arg
          return Props.markPropMaker(function(env) {
            var prop = env.prop;
            var ampFn = env.amplifying(baseFunc);
            function argCheckingWrapper() {
              if (arguments.length !== expectedLength) {
                throw new Error(env + ' takes ' + expectedLength +
                    ' args, not ' + arguments.length);
              }
              return ampFn.apply(this, arguments);
            }
            return {
              enumerable: true,
              value: dontCheckLength ? ampFn : argCheckingWrapper
            };
          });
        }

        tamingClassTable.registerLazy('TextMetrics', function() {
          function TameTextMetrics(feralMetrics) {
            feralMetrics = makeDOMAccessible(feralMetrics);
            // TextMetrics just acts as a record, so we don't need any forwarding
            // wrapper; copying the data is sufficient.
            [
              'actualBoundingBoxAscent',
              'actualBoundingBoxDescent',
              'actualBoundingBoxLeft',
              'actualBoundingBoxRight',
              'alphabeticBaseline',
              'emHeightAscent',
              'emHeightDescent',
              'fontBoundingBoxAscent',
              'fontBoundingBoxDescent',
              'hangingBaseline',
              'ideographicBaseline',
              'width'
            ].forEach(function(prop) {
              this[prop] = +feralMetrics[prop];
            }, this);
            Object.freeze(this);
          }
          inertCtor(TameTextMetrics, Object);
          return cajaVM.def(TameTextMetrics);
        });

        tamingClassTable.registerLazy('CanvasRenderingContext2D', function() {
          // http://dev.w3.org/html5/2dcontext/
          // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#2dcontext
          var TameContext2DConf = new Confidence('TameContext2D');
          function TameContext2D(feralContext, policy) {
            // policy is needed for the PropertyTaming accessors
            feralContext = makeDOMAccessible(feralContext);
            TameContext2DConf.confide(this, taming);
            TameContext2DConf.amplify(this, function(privates) {
              privates.feral = feralContext;
              privates.policy = policy;
              Object.preventExtensions(privates);
            });
          }
          inertCtor(TameContext2D, Object);
          // TODO(kpreid): have inertCtor automatically install an appropriate
          // toString method.
          TameContext2D.prototype.toString = cajaVM.constFunc(function() {
            return '[domado object CanvasRenderingContext2D]';
          });
          Props.define(TameContext2D.prototype, TameContext2DConf, {
            save: tameNoArgOp,
            restore: tameNoArgOp,

            scale: tameFloatsOp(2),
            rotate: tameFloatsOp(1),
            translate: tameFloatsOp(2),
            transform: tameFloatsOp(6),
            setTransform: tameFloatsOp(6),
            // TODO(kpreid): whatwg has resetTransform

            createLinearGradient: tameMethodCustom(
                function(privates, x0, y0, x1, y1) {
              enforceType(x0, 'number', 'x0');
              enforceType(y0, 'number', 'y0');
              enforceType(x1, 'number', 'x1');
              enforceType(y1, 'number', 'y1');
              return new (tamingClassTable.getTamingCtor('CanvasGradient'))(
                  privates.feral.createLinearGradient(x0, y0, x1, y1));
            }),

            createRadialGradient: tameMethodCustom(
                function(privates, x0, y0, r0, x1, y1, r1) {
              enforceType(x0, 'number', 'x0');
              enforceType(y0, 'number', 'y0');
              enforceType(r0, 'number', 'r0');
              enforceType(x1, 'number', 'x1');
              enforceType(y1, 'number', 'y1');
              enforceType(r1, 'number', 'r1');
              return new (tamingClassTable.getTamingCtor('CanvasGradient'))(
                privates.feral.createRadialGradient(x0, y0, r0, x1, y1, r1));
            }),

            createPattern: tameMethodCustom(
                function(privates, imageElement, repetition) {
              // Consider what policy to have wrt reading the pixels from image
              // elements before implementing this.
              throw new Error(
                  'Domado: canvas createPattern not yet implemented');
            }),

            clearRect:  tameRectMethod(function() {}),
            fillRect:   tameRectMethod(function() {}),
            strokeRect: tameRectMethod(function() {}),

            beginPath: tameNoArgOp,
            closePath: tameNoArgOp,
            moveTo: tameFloatsOp(2),
            lineTo: tameFloatsOp(2),
            quadraticCurveTo: tameFloatsOp(4),
            bezierCurveTo: tameFloatsOp(6),
            arcTo: tameFloatsOp(5),
            // TODO(kpreid): whatwg adds 2 optional args to arcTo
            rect: tameFloatsOp(4),
            arc: tameMethodCustom(function(
                privates, x, y, radius, startAngle, endAngle, anticlockwise) {
              enforceType(x, 'number', 'x');
              enforceType(y, 'number', 'y');
              enforceType(radius, 'number', 'radius');
              enforceType(startAngle, 'number', 'startAngle');
              enforceType(endAngle, 'number', 'endAngle');
              anticlockwise = anticlockwise || false;
              enforceType(anticlockwise, 'boolean', 'anticlockwise');
              privates.feral.arc(
                  x, y, radius, startAngle, endAngle, anticlockwise);
            }),

            // TODO(kpreid): Path objects for filling/stroking
            fill: tameNoArgOp,
            stroke: tameNoArgOp,
            clip: tameNoArgOp,

            // TODO(kpreid): Generic type-checking wrapper to eliminate the need
            // for this code
            // TODO(kpreid): implement spec'd optional args
            isPointInPath: tameMethodCustom(function(privates, x, y) {
              enforceType(x, 'number', 'x');
              enforceType(y, 'number', 'y');
              return enforceType(privates.feral.isPointInPath(x, y), 'boolean');
            }),

            fillText: tameDrawText,
            strokeText: tameDrawText,

            measureText: tameMethodCustom(function(privates, string) {
              enforceType(string, 'string', 'measureText argument');
              return new (tamingClassTable.getTamingCtor('TextMetrics'))(
                  privates.feral.measureText(string));
            }),

            drawImage: tameMethodCustom(function(privates, imageElement) {
              // TODO(kpreid): Implement. Original concern was reading image
              // data, but Caja's general policy is NOT to reimplement
              // same-origin restrictions.
              throw new Error('Domado: canvas drawImage not yet implemented');
            }),

            createImageData: tameMethodCustom(function(privates, sw, sh) {
              enforceType(sw, 'number', 'sw');
              enforceType(sh, 'number', 'sh');
              // TODO(kpreid): taming membrane? or is this best considered a
              // copy?
              return new (tamingClassTable.getTamingCtor('ImageData'))(
                  privates.feral.createImageData(sw, sh));
            }),
            getImageData: tameRectMethod(function(image) {
              return new (tamingClassTable.getTamingCtor('ImageData'))(image);
            }),
            putImageData: tameMethodCustom(function(privates,
                tameImageData, dx, dy, dirtyX, dirtyY, dirtyWidth,
                dirtyHeight) {
              tameImageData = TameImageDataT.coerce(tameImageData);
              enforceFinite(dx, 'dx');
              enforceFinite(dy, 'dy');
              switch (arguments.length - 1) {
              case 3:
                dirtyX = 0;
                dirtyY = 0;
                dirtyWidth = tameImageData.width;
                dirtyHeight = tameImageData.height;
                break;
              case 7:
                enforceFinite(dirtyX, 'dirtyX');
                enforceFinite(dirtyY, 'dirtyY');
                enforceFinite(dirtyWidth, 'dirtyWidth');
                enforceFinite(dirtyHeight, 'dirtyHeight');
                break;
              default:
                throw 'putImageData cannot accept ' + (arguments.length - 1) +
                    ' arguments';
              }
              TameImageDataConf.amplify(tameImageData, function(imageDataPriv) {
                var tamePixelArray = imageDataPriv.tamePixelArray;
                if (tamePixelArray) {
                  tamePixelArray._d_canvas_writeback();
                }
                privates.feral.putImageData(imageDataPriv.feral,
                    dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
              });
            }, true)
          });
          var CP_STYLE = Props.markPropMaker(function(env) {
            var prop = env.prop;
            return {
              enumerable: true,
              get: env.amplifying(function(privates) {
                var value = privates.feral[prop];
                if (typeof(value) === 'string') {
                  return canonColor(value);
                } else if (cajaVM.passesGuard(TameGradientT,
                                              taming.tame(value))) {
                  return taming.tame(value);
                } else {
                  throw new Error('Internal: Can\'t tame value ' + value +
                      ' of ' + prop);
                }
              }),
              set: env.amplifying(function(privates, newValue) {
                if (isColor(newValue)) {
                  privates.feral[prop] = newValue;
                } else if (typeof(newValue) === 'object' &&
                           cajaVM.passesGuard(TameGradientT, newValue)) {
                  privates.feral[prop] = taming.untame(newValue);
                } // else do nothing
                return newValue;
              })
            };
          });
          Props.define(TameContext2D.prototype, TameContext2DConf, {
            // We filter the values supplied to setters in case some browser
            // extension makes them more powerful, e.g. containing scripting or
            // a URL.
            // TODO(kpreid): Do we want to filter the *getters* as well?
            // Scenarios: (a) canvas shared with innocent code, (b) browser
            // quirks?? If we do, then what should be done with a bad value?
            globalAlpha: PT.RWCond(
                function (v) { return typeof v === 'number' &&
                                      0.0 <= v && v <= 1.0;     }),
            globalCompositeOperation: PT.RWCond(
                StringTest([
                  'source-atop',
                  'source-in',
                  'source-out',
                  'source-over',
                  'destination-atop',
                  'destination-in',
                  'destination-out',
                  'destination-over',
                  'lighter',
                  'copy',
                  'xor'
                ])),
            strokeStyle: CP_STYLE,
            fillStyle: CP_STYLE,
            lineWidth: PT.RWCond(
                function (v) { return typeof v === 'number' &&
                                      0.0 < v && v !== Infinity; }),
            lineCap: PT.RWCond(
                StringTest([
                  'butt',
                  'round',
                  'square'
                ])),
            lineJoin: PT.RWCond(
                StringTest([
                  'bevel',
                  'round',
                  'miter'
                ])),
            miterLimit: PT.RWCond(
                function (v) { return typeof v === 'number' &&
                                      0 < v && v !== Infinity; }),
            shadowOffsetX: PT.RWCond(
                function (v) {
                  return typeof v === 'number' && isFinite(v); }),
            shadowOffsetY: PT.RWCond(
                function (v) {
                  return typeof v === 'number' && isFinite(v); }),
            shadowBlur: PT.RWCond(
                function (v) { return typeof v === 'number' &&
                                      0.0 <= v && v !== Infinity; }),
            shadowColor: Props.markPropMaker(function(env) {
              return {
                enumerable: true,
                // TODO(kpreid): Better tools for deriving descriptors
                get: CP_STYLE(env).get,
                set: PT.RWCond(isColor)(env).set
              };
            }),

            font: PT.RWCond(isFont),
            textAlign: PT.RWCond(
                StringTest([
                  'start',
                  'end',
                  'left',
                  'right',
                  'center'
                ])),
            textBaseline: PT.RWCond(
                StringTest([
                  'top',
                  'hanging',
                  'middle',
                  'alphabetic',
                  'ideographic',
                  'bottom'
                ]))
          });
          return cajaVM.def(TameContext2D);
        });

        defineElement({
          domClass: 'HTMLCanvasElement',
          properties: function() { return {
            height: PT.filter(false, identity, false, Number),
            width: PT.filter(false, identity, false, Number),
            getContext: Props.ampMethod(function(privates, contextId) {
              // TODO(kpreid): We can refine this by adding policy checks to the
              // canvas taming, which allow getImageData and so on but not any
              // drawing. Not bothering to do that for now; if you have a use
              // for it let us know.
              privates.policy.requireEditable();

              enforceType(contextId, 'string', 'contextId');
              switch (contextId) {
                case '2d':
                  var feralContext = privates.feral.getContext('2d');
                  var TameContext = tamingClassTable.getTamingCtor(
                      'CanvasRenderingContext2D');
                  if (!taming.hasTameTwin(feralContext)) {
                    taming.tamesTo(feralContext, cajaVM.def(new TameContext(
                        feralContext, privates.policy)));
                  }
                  return taming.tame(feralContext);
                default:
                  // http://dev.w3.org/html5/spec/the-canvas-element.html#the-canvas-element
                  // "If contextId is not the name of a context supported by the
                  // user agent, return null and abort these steps."
                  return null;
              }
            })
          }; }
        });
      })();

      defineTrivialElement('HTMLDListElement');
      defineTrivialElement('HTMLDivElement');

      function FormElementProxyHandler(target) {
        CollectionProxyHandler.call(this, target);
      }
      inherit(FormElementProxyHandler, CollectionProxyHandler);
      Props.define(FormElementProxyHandler.prototype, null, {
        toString: Props.overridable(false, function() {
          return '[FormElementProxyHandler]';
        }),
        col_lookup: Props.overridable(true, cajaVM.constFunc(function(name) {
          return nodeAmplify(this.target, function(privates) {
            return makeDOMAccessible(
                makeDOMAccessible(privates.feral.elements).namedItem(name));
          });
        })),
        col_evaluate: Props.overridable(true, cajaVM.constFunc(
            function(nodeOrList) {
          if (taming.hasTameTwin(nodeOrList)) {
            return taming.tame(nodeOrList);
          } else if ('nodeType' in nodeOrList) {
            return defaultTameNode(nodeOrList);
          } else if ('length' in nodeOrList) {
            var tameList = new TameNodeList(nodeOrList, defaultTameNode);
            taming.tamesTo(nodeOrList, tameList);
            return tameList;
          } else {
            throw new Error('could not interpret form.elements result');
          }
        })),
        col_names: Props.overridable(true, cajaVM.constFunc(function() {
          // TODO(kpreid): not quite right result set
          return Object.getOwnPropertyNames(this.target.elements);
        }))
      });
      cajaVM.def(FormElementProxyHandler);

      defineElement({
        domClass: 'HTMLFormElement',
        proxyType: FormElementProxyHandler,
        construct: nodeAmp(function(privates) {
          // Must be a value property because ES5/3 does not allow .length
          // accessors.
          // TODO(kpreid): Detect and use an accessor on ES5.
          // TODO(kpreid): Review whether this and .elements are doing the best
          // they can WRT liveness.
          Object.defineProperty(this, "length", {
            value: privates.feral.length
          });
        }),
        properties: function() { return {
          action: PT.filterAttr(defaultToEmptyStr, String),
          elements: PT.TameMemoIf(false, 'elements', function(f) {
            // TODO(kpreid): make tameHTMLCollection live-capable
            return tameHTMLCollection(f, defaultTameNode);
          }),
          enctype: PT.filterAttr(defaultToEmptyStr, String),
          method: PT.filterAttr(defaultToEmptyStr, String),
          target: PT.filterAttr(defaultToEmptyStr, String),
          submit: Props.ampMethod(function(privates) {
            // TODO(felix8a): need to test handlingUserAction.
            privates.policy.requireEditable();
            return domicile.handlingUserAction && privates.feral.submit();
          }),
          reset: Props.ampMethod(function(privates) {
            privates.policy.requireEditable();
            return privates.feral.reset();
          })
        }; }
      });

      defineTrivialElement('HTMLHeadingElement');
      defineTrivialElement('HTMLHRElement');

      defineElement({
        virtualized: true,
        domClass: 'HTMLHeadElement'
      });

      defineElement({
        virtualized: true,
        domClass: 'HTMLHtmlElement'
      });

      defineElement({
        domClass: 'HTMLIFrameElement',
        construct: nodeAmp(function(privates) {
          privates.contentDomicile = undefined;
          privates.seenContentDocument = undefined;
        }),
        properties: function() { return {
          align: {
            enumerable: true,
            get: nodeAmp(function(privates) {
              return privates.feral.align;
            }),
            set: nodeAmp(function(privates, alignment) {
              privates.policy.requireEditable();
              alignment = String(alignment);
              if (alignment === 'left' ||
                  alignment === 'right' ||
                  alignment === 'center') {
                privates.feral.align = alignment;
              }
            })
          },
          frameBorder: {
            enumerable: true,
            get: nodeAmp(function(privates) {
              return privates.feral.frameBorder;
            }),
            set: nodeAmp(function(privates, border) {
              privates.policy.requireEditable();
              border = String(border).toLowerCase();
              if (border === '0' || border === '1' ||
                  border === 'no' || border === 'yes') {
                privates.feral.frameBorder = border;
              }
            })
          },
          height: PT.filterProp(identity, Number),
          width:  PT.filterProp(identity, Number),
          src: PT.filterAttr(identity, identity), // rewrite handled for attr
          name: PT.filterAttr(identity, identity), // rejection handled for attr
          contentDocument: {
            enumerable: true,
            get: cajaVM.constFunc(function() {
              return contentDomicile(this).document;
            })
          },
          contentWindow: {
            enumerable: true,
            get: cajaVM.constFunc(function() {
              return contentDomicile(this).window;
            })
          }
        }; }
      });
      function contentDomicile(tameIFrame) {
        // TODO(kpreid): Once we support loading content via src=, we will need
        // to consider whether this should always allow access to said content,
        // and probably other issues.
        return nodeAmplify(tameIFrame, function(privates) {
          var frameFeralDoc = makeDOMAccessible(privates.feral.contentDocument);
          if (!privates.contentDomicile ||
              frameFeralDoc !== privates.seenContentDocument) {
            if (!frameFeralDoc) {
              return {document: null, window: null};
            }

            var subDomicile = privates.contentDomicile = attachDocument(
                '-caja-iframe___', naiveUriPolicy, frameFeralDoc,
                optTargetAttributePresets, taming);
            privates.seenContentDocument = frameFeralDoc;

            // Replace document structure with virtualized forms
            // TODO(kpreid): Use an alternate HTML schema (requires refactoring)
            // which makes <html> <head> <body> permitted (in particular,
            // non-opaque) so that this is unnecessary.
            var tdoc = subDomicile.document;
            var child;
            while ((child = tdoc.lastChild)) {
              tdoc.removeChild(child);
            }
            // Creating HtmlEmitter hooks up document.write, and finish() (i.e.
            // end-of-file, i.e. an empty-string input document) triggers
            // construction of the virtualized global structure.
            var emitter = new HtmlEmitter(makeDOMAccessible,
                subDomicile.htmlEmitterTarget,
                naiveUriPolicy.mitigate, subDomicile);
            emitter.finish();
          }
          return privates.contentDomicile;
        });
      }

      var featureTestImage = makeDOMAccessible(document.createElement('img'));
      defineElement({
        domClass: 'HTMLImageElement',
        properties: function() { return {
          alt: PT.filterProp(String, String),
          height: PT.filterProp(Number, Number),
          src: PT.filter(false, String, true, identity),
          width: PT.filterProp(Number, Number),
          naturalHeight: Props.cond('naturalHeight' in featureTestImage,
              PT.filterProp(Number, Number)),
          naturalWidth: Props.cond('naturalWidth' in featureTestImage,
              PT.filterProp(Number, Number)),
          complete: Props.cond('complete' in featureTestImage,
              PT.filterProp(Boolean, Boolean))
        }; }
      });
      // Per https://developer.mozilla.org/en-US/docs/DOM/Image as of 2012-09-24
      namedConstructors.Image = innocuous(function ImageCtor(width, height) {
        var element = tameDocument.createElement('img');
        if (width !== undefined) { element.width = width; }
        if (height !== undefined) { element.height = height; }
        return element;
      });

      // Common supertype just to save some code -- does not correspond to real
      // HTML, but should be harmless. Ideally we wouldn't export this.
      function toInt(x) { return x | 0; }
      defineElement({
        domClass: 'CajaFormField',
        properties: function() { return {
          autofocus: PT.ro,
          disabled: PT.rw,
          form: PT.related,
          maxLength: PT.rw,
          name: PT.rw,
          value: PT.filter(
            false, function (x) { return x == null ? null : String(x); },
            false, function (x) { return x == null ? '' : '' + x; })
        }; }
      });
      
      defineElement({
        superclass: 'CajaFormField',
        domClass: 'HTMLInputElement',
        properties: function() { return {
          checked: PT.filterProp(identity, Boolean),
          defaultChecked: PT.rw,
          defaultValue: PT.filter(
            false, function (x) { return x == null ? null : String(x); },
            false, function (x) { return x == null ? '' : '' + x; }),
          min: PT.rw,
          max: PT.rw,
          readOnly: PT.rw,
          selectedIndex: PT.filterProp(identity, toInt),
          size: PT.rw,
          step: PT.rw,
          type: PT.rw,
          valueAsNumber: PT.rw,
          select: NP_noArgEditVoidMethod,
          stepDown: NP_noArgEditVoidMethod,
          stepUp: NP_noArgEditVoidMethod
        }; }
      });

      defineElement({
        superclass: 'CajaFormField',
        domClass: 'HTMLButtonElement',
        properties: function() { return {
          type: PT.rw
        }; }
      });

      defineElement({
        superclass: 'CajaFormField',
        domClass: 'HTMLSelectElement',
        properties: function() { return {
          multiple: PT.rw,
          options: PT.TameMemoIf(nodeListsAreLive, 'options', function(f) {
            return new TameOptionsList(f, defaultTameNode, 'name');
          }),
          selectedIndex: PT.filterProp(identity, toInt),
          type: PT.ro
        }; }
      });

      defineElement({
        superclass: 'CajaFormField',
        domClass: 'HTMLTextAreaElement',
        properties: function() { return {
          type: PT.rw
        }; }
      });

      defineElement({
        domClass: 'HTMLLabelElement',
        properties: function() { return {
          htmlFor: Props.actAs('for', PT.filterAttr(identity, identity))
        }; }
      });

      defineElement({
        domClass: 'HTMLMediaElement',
        properties: function() { return {
          // TODO(kpreid): audioTracks taming
          autoplay: NP_writePolicyOnly,
          // TODO(kpreid): buffered (TimeRanges) taming
          // TODO(kpreid): controller (MediaController) taming
          controls: NP_writePolicyOnly,
          crossOrigin: NP_writePolicyOnly,
          currentSrc: PT.ro,
          currentTime: PT.ro,
          defaultMuted: {
            // TODO: express this generically
            enumerable: true,
            get: nodeAmp(function(privates) {
              return privates.feral.defaultMuted;
            }),
            set: innocuous(function(v) {
              if (v) {
                this.setAttribute('muted', '');
              } else {
                this.removeAttribute('muted');
              }
            })
          },
          defaultPlaybackRate: PT.filterProp(identity, Number),
          duration: PT.ro,
          ended: PT.ro,
          // TODO(kpreid): error (MediaError) taming
          loop: NP_writePolicyOnly,
          mediaGroup: PT.filterAttr(identity, identity),  // rewritten like id
          muted: PT.ro,  // TODO(kpreid): Pending policy about guest audio
          networkState: PT.ro,
          paused: PT.ro,
          playbackRate: PT.filterProp(identity, Number),
          // TODO(kpreid): played (TimeRanges) taming
          preload: NP_writePolicyOnly,
          readyState: PT.ro,
          // TODO(kpreid): seekable (TimeRanges) taming
          seeking: PT.ro,
          src: NP_writePolicyOnly,
          // TODO(kpreid): textTracks (TextTrackList) taming
          // TODO(kpreid): videoTracks (VideoTrackList) taming
          volume: PT.ro,  // TODO(kpreid): Pending policy about guest audio
          canPlayType: Props.ampMethod(function(privates, type) {
            return String(privates.feral.canPlayType(String(type)));
          }),
          fastSeek: Props.ampMethod(function(privates, time) {
            // TODO(kpreid): Use generic taming like canvas does
            privates.policy.requireEditable();
            privates.feral.fastSeek(+time);
          }),
          load: NP_noArgEditVoidMethod,
          pause: NP_noArgEditVoidMethod,
          play: Props.ampMethod(function(privates, time) {
            // TODO(kpreid): Better programmatic control approach
            if (domicile.handlingUserAction) {
              privates.feral.play();
            }
          })
        }; }
      });

      defineElement({
        domClass: 'HTMLOptionElement',
        properties: function() { return {
          defaultSelected: PT.filterProp(Boolean, Boolean),
          disabled: PT.filterProp(Boolean, Boolean),
          form: PT.related,
          index: PT.filterProp(Number),
          label: PT.filterProp(String, String),
          selected: PT.filterProp(Boolean, Boolean),
          text: PT.filterProp(String, String),
          // TODO(kpreid): Justify these specialized filters.
          value: PT.filterProp(
            function (x) { return x == null ? null : String(x); },
            function (x) { return x == null ? '' : '' + x; })
        }; }
      });
      // Per https://developer.mozilla.org/en-US/docs/DOM/Option
      // as of 2012-09-24
      namedConstructors.Option = innocuous(function OptionCtor(
          text, value, defaultSelected, selected) {
        var element = tameDocument.createElement('option');
        if (text !== undefined) { element.text = text; }
        if (value !== undefined) { element.value = value; }
        if (defaultSelected !== undefined) {
          element.defaultSelected = defaultSelected;
        }
        if (selected !== undefined) { element.selected = selected; }
        return element;
      });

      defineTrivialElement('HTMLParagraphElement');
      defineTrivialElement('HTMLPreElement');

      function dynamicCodeDispatchMaker(privates) {
        window.cajaDynamicScriptCounter =
          window.cajaDynamicScriptCounter ?
            window.cajaDynamicScriptCounter + 1 : 0;
        var name = "caja_dynamic_script" +
          window.cajaDynamicScriptCounter + '___';
        window[name] = function() {
          try {
            if (privates.scriptSrc &&
              'function' === typeof domicile.evaluateUntrustedExternalScript) {
              // Per HTML5 spec (2013-02-08), execution time (now) is when the
              // relative URL is resolved, not e.g. setAttribute time.
              domicile.evaluateUntrustedExternalScript(
                  URI.utils.resolve(domicile.pseudoLocation.href,
                      privates.scriptSrc),
                  privates.feral);  // load/error events are fired on this node
            }
          } finally {
            window[name] = undefined;
          }
        };
        return name + "();";
      }

      // General hook in document.createElement which currently only applies to
      // <script>s; keeping it simple till we need more generality.
      var postInitCreatedElement = nodeAmp(function(privates) {
        if (privates.feral.tagName === 'SCRIPT') {
          privates.feral.appendChild(
            document.createTextNode(
              dynamicCodeDispatchMaker(privates)));
        }
      });

      defineElement({
        domClass: 'HTMLScriptElement',
        forceChildrenNotEditable: true,  // critical to script isolation
        construct: nodeAmp(function(privates) {
          privates.scriptSrc = undefined;
          // See also postInitCreatedElement, which initializes
          // document.createElement'd scripts for src loading
        }),
        properties: function() { return {
          src: NP_writePolicyOnly,
          setAttribute: Props.ampMethod(function(privates, attrib, value) {
            var feral = privates.feral;
            privates.policy.requireEditable();
            TameElement.prototype.setAttribute.call(this, attrib, value);
            var attribName = String(attrib).toLowerCase();
            if ("src" === attribName) {
              privates.scriptSrc = String(value);
            }
          })
        }; }
      });

      defineTrivialElement('HTMLSpanElement');

      defineElement({
        domClass: 'HTMLStyleElement',
        forceChildrenNotEditable: true,  // critical to style isolation
        properties: function() {
          var styleForFeatureTests = makeDOMAccessible(
              document.createElement('style'));
          return {
            disabled: PT.filterProp(identity, Boolean),
            media: NP_writePolicyOnly,
            scoped: Props.cond('scoped' in styleForFeatureTests,
                PT.filterProp(identity, Boolean)),
            // TODO(kpreid): property 'sheet'
            type: PT.ro
          };
        }
      });

      defineElement({
        domClass: 'HTMLTableColElement',
        properties: function() { return {
          align: PT.filterProp(identity, identity),
          vAlign: PT.filterProp(identity, identity)
        }; }
      });

      defineTrivialElement('HTMLTableCaptionElement');

      defineElement({
        domClass: 'HTMLTableCellElement',
        properties: function() { return {
          colSpan: PT.filterProp(identity, identity),
          rowSpan: PT.filterProp(identity, identity),
          cellIndex: PT.ro,
          noWrap: PT.filterProp(identity, identity) // HTML5 Obsolete
        }; }
      });
      defineElement({
        superclass: 'HTMLTableCellElement',
        domClass: 'HTMLTableDataCellElement'
      });
      defineElement({
        superclass: 'HTMLTableCellElement',
        domClass: 'HTMLTableHeaderCellElement'
      });

      function requireIntIn(idx, min, max) {
        if (idx !== (idx | 0) || idx < min || idx > max) {
          throw new Error(INDEX_SIZE_ERROR);
        }
      }

      defineElement({
        domClass: 'HTMLTableRowElement',
        properties: function() { return {
          // TODO(kpreid): Arrange so there are preexisting functions to pass
          // into TameMemoIf rather than repeating this inline stuff.
          cells: PT.TameMemoIf(nodeListsAreLive, 'cells', function(feralList) {
            return new TameNodeList(feralList, defaultTameNode);
          }),
          rowIndex: PT.ro,
          sectionRowIndex: PT.ro,
          insertCell: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.cells.length);
            return defaultTameNode(
                privates.feral.insertCell(index),
                privates.editable);
          }),
          deleteCell: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.cells.length);
            privates.feral.deleteCell(index);
          })
        }; }
      });

      defineElement({
        domClass: 'HTMLTableSectionElement',
        properties: function() { return {
          rows: PT.TameMemoIf(nodeListsAreLive, 'rows', function(feralList) {
            return new TameNodeList(feralList, defaultTameNode);
          }),
          insertRow: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.rows.length);
            return defaultTameNode(privates.feral.insertRow(index));
          }),
          deleteRow: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.rows.length);
            privates.feral.deleteRow(index);
          })
        }; }
      });

      defineElement({
        // nonstandard but sound
        superclass: 'HTMLTableSectionElement',
        domClass: 'HTMLTableElement',
        properties: function() { return {
          tBodies: PT.TameMemoIf(nodeListsAreLive, 'tBodies',
              nodeAmp(function(privates, f) {
            if (privates.policy.childrenVisible) {
              return new TameNodeList(f, defaultTameNode);
            } else {
              return fakeNodeList([], 'NodeList');
            }
          })),
          tHead: NP_tameDescendant,
          tFoot: NP_tameDescendant,
          cellPadding: PT.filterAttr(Number, fromInt),
          cellSpacing: PT.filterAttr(Number, fromInt),
          border:      PT.filterAttr(Number, fromInt),
          createTHead: NP_noArgEditMethodReturningNode,
          deleteTHead: NP_noArgEditVoidMethod,
          createTFoot: NP_noArgEditMethodReturningNode,
          deleteTFoot: NP_noArgEditVoidMethod,
          createCaption: NP_noArgEditMethodReturningNode,
          deleteCaption: NP_noArgEditVoidMethod,
          insertRow: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.rows.length);
            return defaultTameNode(privates.feral.insertRow(index));
          }),
          deleteRow: Props.ampMethod(function(privates, index) {
            privates.policy.requireEditable();
            requireIntIn(index, -1, privates.feral.rows.length);
            privates.feral.deleteRow(index);
          })
        }; }
      });

      defineElement({
        virtualized: true,
        domClass: 'HTMLTitleElement'
      });

      defineTrivialElement('HTMLUListElement');

      defineElement({
        virtualized: null,
        domClass: 'HTMLUnknownElement'
      });

      defineElement({
        superclass: 'HTMLMediaElement',
        domClass: 'HTMLVideoElement',
        properties: function() { return {
          height: PT.rw,
          width: PT.rw,
          poster: PT.filterAttr(identity, identity),
          videoHeight: PT.rw,
          videoWidth: PT.rw
        }; }
      });

      // We are now done with all of the specialized element taming classes.

      // Taming of Events:

      // coerce null and false to 0
      function fromInt(x) { return '' + (x | 0); }

      function tameEvent(event) {
        event = makeDOMAccessible(event);
        if (!taming.hasTameTwin(event)) {
          var tamed = new (tamingClassTable.getTamingCtor('Event'))(
              event, false);
          taming.tamesTo(event, tamed);
        }
        return taming.tame(event);
      }

      tamingClassTable.registerLazy('Event', function() {
        function eventVirtualizingAccessor(fn) {
          return Props.addOverride(Props.ampGetter(fn));
        }

        function P_e_view(transform) {
          return Props.addOverride(PT.ROView(transform));
        }

        var featureTestKeyEvent = {};
        try {
          featureTestKeyEvent = makeDOMAccessible(
              document.createEvent('KeyboardEvent'));
        } catch (e) {}

        function tameEventView(view) {
          if (view === window) {
            return tameWindow;
          } else if (view === null) {
            return null;
          } else {
            if (typeof console !== 'undefined') {
              console.warn('Domado: Discarding unrecognized feral view value:',
                  view);
            }
            return null;
          }
        }
        function untameEventView(view) {
          if (view === tameWindow) {
            return window;
          } else if (view === null) {
            return null;
          } else {
            if (typeof console !== 'undefined') {
              console.warn('Domado: Discarding unrecognized guest view value:',
                  view);
            }
          }
        }

        /**
         * Helper for init*Event.
         * 'method' is relied on. 'args' should be untamed.
         */
        function tameInitSomeEvent(
            privates, method, type, bubbles, cancelable, args) {
          if (privates.notYetDispatched) {
            bridal.initEvent(
                privates.feral, method, type, bubbles, cancelable, args);
          } else {
            // Do nothing. This prevents guests using initEvent to mutate
            // browser-generated events that will be seen by the host.
            // It also matches browser behavior (Chrome and FF, as of 2013-01-07),
            // because they have initEvent do nothing if the event has already
            // been dispatched, but we don't want to rely on that for security,
            // and bridal's initEvent emulation for IE does not have that
            // property.
          }
        }

        function TameEvent(event, isSyntheticEvent) {
          assert(!!event);
          TameEventConf.confide(this, taming);
          eventAmplify(this, function(privates) {
            privates.feral = event;
            privates.notYetDispatched = isSyntheticEvent;
            Object.preventExtensions(privates);
          });
          return this;
        }
        inertCtor(TameEvent, Object);
        Props.define(TameEvent.prototype, TameEventConf, {
          eventPhase: P_e_view(Number),
          type: P_e_view(function(type) {
            return bridal.untameEventType(String(type));
          }),
          bubbles: P_e_view(Boolean),
          cancelable: P_e_view(Boolean),
          view: P_e_view(tameEventView),
          target: eventVirtualizingAccessor(function(privates) {
            var event = privates.feral;
            return tameRelatedNode(event.target || event.srcElement);
          }),
          srcElement: P_e_view(tameRelatedNode),
          currentTarget: P_e_view(tameRelatedNode),
          relatedTarget: eventVirtualizingAccessor(function(privates) {
            var e = privates.feral;
            var t = e.relatedTarget;
            if (!t) {
              if (e.type === 'mouseout') {
                t = e.toElement;
              } else if (e.type === 'mouseover') {
                t = e.fromElement;
              }
            }
            return tameRelatedNode(t);
          }),
          fromElement: P_e_view(tameRelatedNode),
          toElement: P_e_view(tameRelatedNode),
          detail: P_e_view(Number),
          pageX: P_e_view(Number),
          pageY: P_e_view(Number),
          altKey: P_e_view(Boolean),
          ctrlKey: P_e_view(Boolean),
          metaKey: P_e_view(Boolean),
          shiftKey: P_e_view(Boolean),
          button: P_e_view(function (v) { return v && Number(v); }),
          clientX: P_e_view(Number),
          clientY: P_e_view(Number),
          screenX: P_e_view(Number),
          screenY: P_e_view(Number),
          which: P_e_view(function (v) { return v && Number(v); }),
          location: P_e_view(Number),  // KeyboardEvent
          keyCode: P_e_view(function(v) { return v && Number(v); }),
          charCode: P_e_view(function(v) { return v && Number(v); }),
          key: Props.cond('key' in featureTestKeyEvent, P_e_view(String)),
          char: Props.cond('char' in featureTestKeyEvent, P_e_view(String)),
          stopPropagation: Props.ampMethod(function(privates) {
            // TODO(mikesamuel): make sure event doesn't propagate to dispatched
            // events for this gadget only.
            // But don't allow it to stop propagation to the container.
            if (privates.feral.stopPropagation) {
              privates.feral.stopPropagation();
            } else {
              privates.feral.cancelBubble = true;
            }
          }),
          preventDefault: Props.ampMethod(function(privates) {
            // TODO(mikesamuel): make sure event doesn't propagate to dispatched
            // events for this gadget only.
            // But don't allow it to stop propagation to the container.
            if (privates.feral.preventDefault) {
              privates.feral.preventDefault();
            } else {
              privates.feral.returnValue = false;
            }
          }),

          initEvent: Props.ampMethod(function(
              privates, type, bubbles, cancelable) {
            tameInitSomeEvent.call(this, privates, 'initEvent', type, bubbles,
                cancelable, []);
          }),
          initUIEvent: Props.ampMethod(function(
              privates, type, bubbles, cancelable, view, detail) {
            tameInitSomeEvent.call(this, privates, 'initUIEvent', type, bubbles,
                cancelable, [untameEventView(view), +detail]);
          }),
          initMouseEvent: Props.ampMethod(function(
            // per MDN
              privates, type, bubbles, cancelable, view, detail, screenX,
              screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey,
              button, relatedTarget) {
            tameInitSomeEvent.call(this, privates, 'initMouseEvent', type,
                bubbles, cancelable, [untameEventView(view), +detail, +screenX,
                +screenY, +clientX, +clientY, Boolean(ctrlKey), Boolean(altKey),
                Boolean(shiftKey), Boolean(metaKey), +button,
                toFeralNode(relatedTarget)]);
          }),
          initKeyEvent: Props.cond(
              'initKeyEvent' in featureTestKeyEvent,
              Props.ampMethod(function(
                  // per MDN
                  privates, type, bubbles, cancelable, view, ctrlKey, altKey,
                  shiftKey, metaKey, keyCode, charCode) {
            tameInitSomeEvent.call(this, privates, 'initKeyEvent', type,
                bubbles, cancelable, [untameEventView(view), Boolean(ctrlKey),
                Boolean(altKey), Boolean(shiftKey), Boolean(metaKey),
                Number(keyCode), Number(charCode)]);
          })),
          initKeyboardEvent: Props.cond(
              'initKeyboardEvent' in featureTestKeyEvent,
              Props.ampMethod(function(
                  // per MDN
                  privates, type, bubbles, cancelable, view, char, key,
                  location, modifiers, repeat, locale) {
            tameInitSomeEvent.call(this, privates, 'initKeyboardEvent', type,
                bubbles, cancelable, [untameEventView(view), String(char),
                String(key), Number(location), String(modifiers),
                Boolean(repeat), String(locale)]);
          })),

          toString: Props.overridable(false, innocuous(function() {
            return '[domado object Event]';
          }))
        });
        return cajaVM.def(TameEvent);  // and defend its prototype
      });

      // As far as we know, creating any particular event type is harmless; but
      // this whitelist exists to protect against novel extensions which may
      // have unwanted behavior and/or interactions we are not aware of.
      // Note also that our initEvent taming rewrites the event .type, so that
      // e.g. a "click" event is "click_custom___" and will not trigger host
      // event handlers and so on.
      var eventTypeWhitelist = {
        // Info sources:
        // https://developer.mozilla.org/en-US/docs/DOM/document.createEvent#Notes
        // http://www.w3.org/TR/DOM-Level-2-Events/events.html
        'Events': 0, 'Event': 0,
        'UIEvents': 0, 'UIEvent': 0,
        'MouseEvents': 0, 'MouseEvent': 0,
        // omitted MutationEvent, not particularly likely to be desirable
        'HTMLEvents': 0,
        'KeyEvents': 0, 'KeyboardEvent': 0
      };

      function TameHTMLDocument(doc, container, domain) {
        TameNode.call(this, nodePolicyEditable);
        nodeAmplify(this, function(privates) {
          privates.feralDoc = doc;
          privates.feralContainerNode = container;
          privates.onLoadListeners = [];
          privates.onDCLListeners = [];

          // Used to implement operations on the document, never exposed to the
          // guest.
          privates.tameContainerNode = defaultTameNode(container);
        });

        Props.define(this, TameNodeConf, {
          domain: P_constant(domain)
        });

        installLocation(this);
      }
      tamingClassTable.registerSafeCtor('Document',
          inertCtor(TameHTMLDocument, TameNode, 'HTMLDocument'));
      var forwardContainerProp = Props.markPropMaker(function(env) {
        var prop = env.prop;
        return Props.ampGetter(function(privates) {
          return privates.tameContainerNode[prop];
        });
      });
      var forwardContainerMethod = Props.markPropMaker(function(env) {
        var prop = env.prop;
        return Props.ampMethod(function(privates, opt1, opt2) {
          return privates.tameContainerNode[prop](opt1, opt2);
        });
      });
      Props.define(TameHTMLDocument.prototype, TameNodeConf, {
        nodeType: P_constant(9),
        nodeName: P_constant('#document'),
        nodeValue: P_constant(null),
        firstChild: forwardContainerProp,
        lastChild: forwardContainerProp,
        nextSibling: P_constant(null),
        previousSibling: P_constant(null),
        childNodes: forwardContainerProp,
        attributes: { enumerable: true, get: innocuous(function() {
          return fakeNodeList([], 'HTMLCollection');
        })},
        parentNode: P_constant(null),
        body: {
          enumerable: true,
          get: innocuous(function() {
            // "The body element of a document is the first child of the html
            // element that is either a body element or a frameset element. If
            // there is no such element, it is null."
            // TODO(kpreid): should be internal .documentElement getter only
            var htmlEl = this.documentElement;
            if (!htmlEl) { return null; }
            for (var n = htmlEl.firstChild; n; n = n.nextSibling) {
              if (n.nodeName === 'BODY' || n.nodeName === 'FRAMESET') {
                return n;
              }
            }
            return null;
          }),
          set: innocuous(function(newBody) {
            // "If the new value is not a body or frameset element, then throw a
            // HierarchyRequestError exception and abort these steps."
            newBody = TameNodeT.coerce(newBody);
            if (!(newBody.nodeName === 'BODY' ||
                newBody.nodeName === 'FRAMESET')) {
              // should be HierarchyRequestError
              throw new Error(
                  'Cannot set document.body except to <body> or <frameset>.');
            }
            // "Otherwise, if the new value is the same as the body element, do
            // nothing. Abort these steps."
            // TODO(kpreid): should be internal .body getter only
            var currentBody = this.body;
            if (newBody === currentBody) { return; }
            // "Otherwise, if the body element is not null, then replace that
            // element with the new value in the DOM, as if the root element's
            // replaceChild() method had been called with the new value and the
            // incumbent body element as its two arguments respectively, then
            // abort these steps."
            // TODO(kpreid): should be internal .documentElement getter only
            var htmlEl = this.documentElement;
            if (currentBody !== null) {
              htmlEl.replaceChild(newBody, currentBody);
              return;
            }
            // "Otherwise, if there is no root element, throw a
            // HierarchyRequestError exception and abort these steps."
            if (!htmlEl) {
              // should be HierarchyRequestError
              throw new Error(
                  'Cannot set document.body with no <html>.');
            }
            // "Otherwise, the body element is null, but there's a root element.
            // Append the new value to the root element."
            htmlEl.appendChild(newBody);
          })
        },
        documentElement: {
          enumerable: true,
          get: innocuous(function() {
            var n;
            // In principle, documentElement should be our sole child, but
            // sometimes that gets screwed up, and we end up with more than
            // one child.  Returning something other than the pseudo <html>
            // element will mess up many things, so we first try finding
            // the <html> element
            for (n = this.firstChild; n; n = n.nextSibling) {
              if (n.nodeName === "HTML") { return n; }
            }
            // No <html>, so return the first child that's an element
            for (n = this.firstChild; n; n = n.nextSibling) {
              if (n.nodeType === 1) { return n; }
            }
            // None of our children are elements, fail
            return null;
          })},
        forms: { enumerable: true, get: nodeAmp(function(privates) {
          // privates not used but we need host-exception protection and
          // authority to access 'document'
          
          // TODO(kpreid): Make this a memoized live list.
          var tameForms = [];
          for (var i = 0; i < document.forms.length; i++) {
            var tameForm = tameRelatedNode(
              makeDOMAccessible(document.forms).item(i));
            // tameRelatedNode returns null if the node is not part of
            // this node's virtual document.
            if (tameForm !== null) { tameForms.push(tameForm); }
          }
          return fakeNodeList(tameForms, 'HTMLCollection');
        })},
        title: {
          // TODO(kpreid): get the title element pointer in conformant way

          // http://www.whatwg.org/specs/web-apps/current-work/multipage/dom.html#document.title
          // as of 2012-08-14
          enumerable: true,
          get: innocuous(function() {
            var titleEl = this.getElementsByTagName('title')[0];
            return titleEl ? trimHTML5Spaces(titleEl.textContent) : "";
          }),
          set: innocuous(function(value) {
            var titleEl = this.getElementsByTagName('title')[0];
            if (!titleEl) {
              var head = this.getElementsByTagName('head')[0];
              if (head) {
                titleEl = this.createElement('title');
                head.appendChild(titleEl);
              } else {
                return;
              }
            }
            titleEl.textContent = value;
          })
        },
        compatMode: P_constant('CSS1Compat'),
        ownerDocument: P_constant(null),
        appendChild: forwardContainerMethod,
        insertBefore: forwardContainerMethod,
        removeChild: forwardContainerMethod,
        replaceChild: forwardContainerMethod,
        hasChildNodes: forwardContainerMethod,
        getElementsByTagName: Props.ampMethod(function(privates, tagName) {
          tagName = String(tagName).toLowerCase();
          return tameGetElementsByTagName(privates.feralContainerNode, tagName);
        }),
        getElementsByClassName: Props.ampMethod(function(privates, className) {
          return tameGetElementsByClassName(
              privates.feralContainerNode, className);
        }),
        querySelector: Props.cond(elementForFeatureTests.querySelector,
            Props.ampMethod(function(privates, selector) {
              return tameQuerySelector(privates.feralContainerNode, selector,
                  false);
            })),
        querySelectorAll: Props.cond(elementForFeatureTests.querySelectorAll,
            Props.ampMethod(function(privates, selector) {
              return tameQuerySelector(privates.feralContainerNode, selector,
                  true);
            })),
        addEventListener: Props.ampMethod(
            function(privates, name, listener, useCapture) {
          if (name === 'DOMContentLoaded') {
            ensureValidCallback(listener);
            privates.onDCLListeners.push(listener);
          } else {
            return privates.tameContainerNode.addEventListener(
                name, listener, useCapture);
          }
        }),
        removeEventListener: Props.ampMethod(
            function(privates, name, listener, useCapture) {
          return privates.tameContainerNode.removeEventListener(
              name, listener, useCapture);
        }),
        createComment: Props.ampMethod(function(privates, text) {
          return defaultTameNode(privates.feralDoc.createComment(" "));
        }),
        createDocumentFragment: Props.ampMethod(function(privates) {
          privates.policy.requireEditable();
          return defaultTameNode(privates.feralDoc.createDocumentFragment());
        }),
        createElement: Props.ampMethod(function(privates, tagName) {
          privates.policy.requireEditable();
          tagName = String(tagName).toLowerCase();
          tagName = htmlSchema.virtualToRealElementName(tagName);
          var newEl = privates.feralDoc.createElement(tagName);
          if ("canvas" == tagName) {
            bridal.initCanvasElement(newEl);
          }
          if (elementPolicies.hasOwnProperty(tagName)) {
            var attribs = elementPolicies[tagName]([]);
            if (attribs) {
              for (var i = 0; i < attribs.length; i += 2) {
                bridal.setAttribute(newEl, attribs[+i], attribs[i + 1]);
              }
            }
          }
          var tameEl = defaultTameNode(newEl);
          postInitCreatedElement.call(tameEl);  // Hook for <script>
          return tameEl;
        }),
        createTextNode: Props.ampMethod(function(privates, text) {
          privates.policy.requireEditable();
          return defaultTameNode(privates.feralDoc.createTextNode(
              text !== null && text !== void 0 ? '' + text : ''));
        }),
        getElementById: Props.ampMethod(function(privates, id) {
          id += idSuffix;
          var node = privates.feralDoc.getElementById(id);
          return defaultTameNode(node);
        }),
        // http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-DocumentEvent-createEvent
        createEvent: Props.ampMethod(function(privates, type) {
          type = String(type);
          if (!eventTypeWhitelist.hasOwnProperty(type)) {
            throw new Error('Domado: Non-whitelisted event type "' + type + '"');
          }
          var document = privates.feralDoc;
          var rawEvent;
          if (document.createEvent) {
            rawEvent = document.createEvent(type);
          } else {
            // For IE; ondataavailable is a placeholder. See bridal.js for
            // related code.
            rawEvent = document.createEventObject();
            rawEvent.eventType = 'ondataavailable';
          }
          var tamedEvent = new (tamingClassTable.getTamingCtor('Event'))(
              rawEvent, true);
          taming.tamesTo(rawEvent, tamedEvent);
          return tamedEvent;
        }),
        // TODO(kpreid): Refactor so that writeHook is stashed on the tame
        // document since that is the only place it is needed and gives
        // capability structure.
        write: Props.ampMethod(function(privates) {
          if (!domicile.writeHook) {
            throw new Error('document.write not provided for this document');
          }
          // TODO(kpreid): Per HTML5, document.write is void, so why are we
          // returning anything?
          return domicile.writeHook.write.apply(undefined,
              Array.prototype.slice.call(arguments, 1));
        }),
        writeln: Props.ampMethod(function(privates) {
          if (!domicile.writeHook) {
            throw new Error('document.writeln not provided for this document');
          }
          // We don't write the \n separately rather than copying args, because
          // the HTML parser would rather get fewer larger chunks.
          var args = Array.prototype.slice.call(arguments, 1);
          args.push('\n');
          domicile.writeHook.write.apply(undefined, args);
        }),
        open: Props.ampMethod(function(privates) {
          if (!domicile.writeHook) {
            throw new Error('document.open not provided for this document');
          }
          return domicile.writeHook.open();
        }),
        close: Props.ampMethod(function(privates) {
          if (!domicile.writeHook) {
            throw new Error('document.close not provided for this document');
          }
          return domicile.writeHook.close();
        })
      });
      cajaVM.def(TameHTMLDocument);  // and its prototype

      domicile.setBaseUri = cajaVM.constFunc(function(base) {
        var parsed = URI.parse(base);
        var host = null;
        if (parsed.hasDomain()) {
          host = parsed.hasPort() ? parsed.getDomain() + ':' + parsed.getPort()
              : parsed.getDomain();
        }
        if (!parsed.hasPath()) {
          parsed.setRawPath('/');
        }
        domicile.pseudoLocation = {
          href: parsed.toString(),
          hash: parsed.hasFragment() ? '#' + parsed.getRawFragment() : '',
          host: host,
          hostname: parsed.getDomain(),
          port: parsed.hasPort() ? parsed.getPort() : '',
          protocol: parsed.hasScheme() ? parsed.getScheme() + ':' : null,
          pathname: parsed.getRawPath(),
          search: parsed.hasQuery() ? '?' + parsed.getRawQuery() : ''
        };
      });

      function dispatchToListeners(eventType, eventName, listeners) {
        var event = tameDocument.createEvent(eventType);
        event.initEvent(eventName, false, false);
        // In case a listener attempts to append another listener
        var len = listeners.length;
        for (var i = 0; i < len; ++i) {
          tameWindow.setTimeout(
              Function.prototype.bind.call(
                listeners[+i], tameWindow, event), 0);
        }
        listeners.length = 0;
      }

      // Called by the html-emitter when the virtual document has been loaded.
      domicile.signalLoaded = cajaVM.constFunc(function() {
        nodeAmplify(tameDocument, function(privates) {
          dispatchToListeners(
              'Event',
              'DOMContentLoaded',
              privates.onDCLListeners);
          if (tameWindow.onload) {
            tameWindow.setTimeout(tameWindow.onload, 0);
          }
          dispatchToListeners(
              'UIEvent',
              'load',
              privates.onLoadListeners);
        });
      });

      // Currently used by HtmlEmitter to synthesize script load events.
      // Note that it does trigger handler attributes (because our handler
      // attribute support does not catch 'custom' events); if this is needed,
      // then what we need to do is arrange for bridal to not consider the event
      // to be custom (which is OK since it also does not bubble).
      /**
       * Not yet fully general, only because the use case hasn't arisen.
       * Note bubbles=false cancelable=false.
       *
       * @param {string} type e.g. 'Event'
       * @param {string} name e.g. 'click'
       */
      domicile.fireVirtualEvent = function(feralNode, type, name) {
        var event = document.createEvent(type);
        bridal.initEvent(event, 'initEvent', name, false, false, [], true);
        feralNode.dispatchEvent(event);
      };

      function toFeralNode(tame) {
        if (tame === null || tame === undefined) {
          return tame;
        } else {
          // NOTE: will be undefined for pseudo nodes
          return nodeAmplify(tame,
              function(privates) { return privates.feral; });
        }
      }
      cajaVM.constFunc(toFeralNode);

      // For JavaScript handlers.  See function dispatchEvent below
      domicile.handlers = [];
      domicile.tameNode = cajaVM.def(defaultTameNode);
      domicile.feralNode = cajaVM.def(toFeralNode);
      domicile.tameEvent = cajaVM.def(tameEvent);
      domicile.fetchUri = cajaVM.constFunc(function(uri, mime, callback) {
        uriFetch(naiveUriPolicy,
            URI.utils.resolve(domicile.pseudoLocation.href, uri),
          mime, callback);
      });
      domicile.rewriteUri = cajaVM.constFunc(function(uri, mimeType, opt_hints) {
        // (SAME_DOCUMENT, SANDBOXED) is chosen as the "reasonable" set of
        // defaults for this function, which is only used by TCB components
        // to rewrite URIs for sources of data. We assume these sources of
        // data provide no exit from the sandbox, and their effects are shown
        // in the same HTML document view as the Caja guest.
        // TODO(ihab.awad): Rename this function to something more specific
        return uriRewrite(
            naiveUriPolicy,
            String(uri),
            html4.ueffects.SAME_DOCUMENT,
            html4.ltypes.SANDBOXED,
            opt_hints || {});
      });
      // note: referenced reflectively by HtmlEmitter
      domicile.cssUri = cajaVM.constFunc(function(uri, mimeType, prop) {
        uri = String(uri);
        if (!naiveUriPolicy) { return null; }
        return uriRewrite(
            naiveUriPolicy,
            uri,
            html4.ueffects.SAME_DOCUMENT,
            html4.ltypes.SANDBOXED,
            {
              "TYPE": "CSS",
              "CSS_PROP": prop
            });
      });
      domicile.suffix = cajaVM.constFunc(function(nmtokens) {
        var p = String(nmtokens).replace(/^\s+|\s+$/g, '').split(/\s+/g);
        var out = [];
        for (var i = 0; i < p.length; ++i) {
          var nmtoken = rewriteAttribute(null, null, html4.atype.ID, p[+i]);
          if (!nmtoken) { throw new Error(nmtokens); }
          out.push(nmtoken);
        }
        return out.join(' ');
      });
      domicile.suffixStr = idSuffix;
      domicile.ident = cajaVM.constFunc(function(nmtokens) {
        var p = String(nmtokens).replace(/^\s+|\s+$/g, '').split(/\s+/g);
        var out = [];
        for (var i = 0; i < p.length; ++i) {
          var nmtoken = rewriteAttribute(null, null, html4.atype.CLASSES, p[+i]);
          if (!nmtoken) { throw new Error(nmtokens); }
          out.push(nmtoken);
        }
        return out.join(' ');
      });
      domicile.rewriteUriInCss = cajaVM.constFunc(function(value, propName) {
        return value
          ? uriRewrite(naiveUriPolicy, value, html4.ueffects.SAME_DOCUMENT,
                html4.ltypes.SANDBOXED,
                {
                  "TYPE": "CSS",
                  "CSS_PROP": propName
                })
          : void 0;
      });
      domicile.rewriteUriInAttribute = cajaVM.constFunc(
          function(value, tagName, attribName) {
        if (isValidFragment(value)) {
          return value + idSuffix;
        }
        var schemaAttr = htmlSchema.attribute(tagName, attribName);
        return value
          ? uriRewrite(naiveUriPolicy, value, schemaAttr.uriEffect,
                schemaAttr.loaderType, {
                  "TYPE": "MARKUP",
                  "XML_ATTR": attribName,
                  "XML_TAG": tagName
                })
          : void 0;
      });
      domicile.rewriteTargetAttribute = cajaVM.constFunc(
          function(value, tagName, attribName) {
        // TODO(ihab.awad): Parrots much of the code in sanitizeAttrs; refactor
        var atype = null, attribKey;
        if ((attribKey = tagName + '::' + attribName,
             html4.ATTRIBS.hasOwnProperty(attribKey))
            || (attribKey = '*::' + attribName,
                html4.ATTRIBS.hasOwnProperty(attribKey))) {
          atype = html4.ATTRIBS[attribKey];
          return rewriteAttribute(tagName, attribName, atype, value);
        }
        return null;
      });

      // Taming of Styles:

      tamingClassTable.registerLazy('CSSStyleDeclaration', function() {
        var aStyleForCPC = elementForFeatureTests.style;
        aStyleForCPC = makeDOMAccessible(aStyleForCPC);
        var allCssProperties = CssPropertiesCollection(aStyleForCPC);

        // Sealed internals for TameStyle objects, not to be exposed.
        var TameStyleConf = new Confidence('Style');

        function allowProperty(cssPropertyName) {
          return allCssProperties.isCssProp(cssPropertyName);
        };

        /**
         * http://www.w3.org/TR/DOM-Level-2-Style/css.html#CSS-CSSStyleDeclaration
         */
        function TameStyle(style, editable, tameEl) {
          style = makeDOMAccessible(style);

          TameStyleConf.confide(this, taming);
          TameStyleConf.amplify(this, function(privates) {
            privates.feral = style;
            privates.editable = editable;
            privates.tameElement = tameEl;

            privates.readByCanonicalName = function(canonName) {
              return String(style[canonName] || '');
            };
            privates.writeByCanonicalName = function(canonName, val) {
              style[canonName] = val;
            };

            // predeclared for TameComputedStyle
            privates.rawElement = undefined;
            privates.pseudoElement = undefined;

            Object.preventExtensions(privates);
          });
        };
        inertCtor(TameStyle, Object);
        TameStyle.prototype.getPropertyValue =
            TameStyleConf.amplifying(function(privates, cssPropertyName) {
          cssPropertyName = String(cssPropertyName || '').toLowerCase();
          if (!allowProperty(cssPropertyName)) { return ''; }
          var canonName = allCssProperties.getCanonicalPropFromCss(
              cssPropertyName);
          return privates.readByCanonicalName(canonName);
        });
        Props.define(TameStyle.prototype, TameStyleConf, {
          toString: Props.overridable(false, innocuous(function() {
            return '[domado object Style]';
          })),
          cssText: {
            enumerable: true,
            set: TameStyleConf.amplifying(function(privates, value) {
              if (typeof privates.feral.cssText === 'string') {
                privates.feral.cssText = sanitizeStyleAttrValue(value);
              } else {
                // If the browser doesn't support setting cssText, then fall
                // back to setting the style attribute of the containing
                // element.  This won't work for style declarations that are
                // part of stylesheets and not attached to elements.
                privates.tameElement.setAttribute('style', value);
              }
              return true;
            })
          }
        });
        allCssProperties.forEachCanonical(function (stylePropertyName) {
          // TODO(kpreid): make each of these generated accessors more
          // specialized for this name to reduce runtime cost.
          Object.defineProperty(TameStyle.prototype, stylePropertyName, {
            enumerable: canHaveEnumerableAccessors,
            get: TameStyleConf.amplifying(function(privates) {
              if (!privates.feral
                  || !allCssProperties.isCanonicalProp(stylePropertyName)) {
                return void 0;
              }
              var cssPropertyName =
                  allCssProperties.getCssPropFromCanonical(stylePropertyName);
              if (!allowProperty(cssPropertyName)) { return void 0; }
              var canonName =
                  allCssProperties.getCanonicalPropFromCss(cssPropertyName);
              return privates.readByCanonicalName(canonName);
            }),
            set: TameStyleConf.amplifying(function(privates, value) {
              if (!privates.editable) { throw new Error('style not editable'); }
              stylePropertyName = String(stylePropertyName);
              if (!allCssProperties.isCanonicalProp(stylePropertyName)) {
                throw new Error('Unknown CSS property name ' + stylePropertyName);
              }
              var cssPropertyName =
                  allCssProperties.getCssPropFromCanonical(stylePropertyName);
              if (!allowProperty(cssPropertyName)) { return void 0; }
              var tokens = lexCss(value);
              if (tokens.length === 0
                 || (tokens.length === 1 && tokens[0] === ' ')) {
                value = '';
              } else {
                if (!sanitizeStyleProperty(cssPropertyName, tokens)) {
                  console.log('bad value `' + value + '` for CSS property '
                                  + stylePropertyName);
                }
                value = tokens.join(' ');
              }
              var canonName =
                  allCssProperties.getCanonicalPropFromCss(cssPropertyName);
              privates.writeByCanonicalName(canonName, value);
              return true;
            })
          });
        });

        // Support for computed style type reusing these values
        // TODO(kpreid): Do this in a more least-authority way.
        TameStyle.TameStyleConf = TameStyleConf;
        TameStyle.allCssProperties = allCssProperties;

        return cajaVM.def(TameStyle);  // and defends its prototype
      });

      tamingClassTable.registerLazy('CajaComputedCSSStyleDeclaration',
          function() {
        function isNestedInAnchor(el) {
          for (;
              el && el != containerNode;
              el = makeDOMAccessible(el.parentNode)) {
            if (el.tagName && el.tagName.toLowerCase() === 'a') {
              return true;
            }
          }
          return false;
        }

        var TameStyle = tamingClassTable.getTamingCtor('CSSStyleDeclaration');
        var TameStyleConf = TameStyle.TameStyleConf;
        var allCssProperties = TameStyle.allCssProperties;

        function TameComputedStyle(rawElement, pseudoElement) {
          rawElement = rawElement || document.createElement('div');
          TameStyle.call(
              this,
              bridal.getComputedStyle(rawElement, pseudoElement),
              false);
          TameStyleConf.amplify(this, function(privates) {
            privates.rawElement = rawElement;
            privates.pseudoElement = pseudoElement;

            var superReadByCanonicalName =
                privates.readByCanonicalName;
            privates.readByCanonicalName = function(canonName) {
              var propName =
                  allCssProperties.getCssPropFromCanonical(canonName);
              var schemaElement = cssSchema[propName];
              var canReturnDirectValue =
                  (schemaElement
                   && (schemaElement.cssPropBits
                       & CSS_PROP_BIT_HISTORY_INSENSITIVE))
                  || !isNestedInAnchor(this.rawElement);
              if (canReturnDirectValue) {
                return superReadByCanonicalName.call(this, canonName);
              } else {
                return TameStyleConf.amplify(
                    new TameComputedStyle(containerNode, this.pseudoElement),
                    function(p2) {
                  return p2.readByCanonicalName(canonName);
                });
              }
            };
            privates.writeByCanonicalName = function(canonName) {
              throw 'Computed styles not editable: This code should be ' +
                  'unreachable';
            };
          });
        };
        inertCtor(TameComputedStyle,
            tamingClassTable.getTamingCtor('CSSStyleDeclaration'));
        Props.define(TameComputedStyle, TameStyleConf, {
          toString: Props.overridable(false, innocuous(function() {
            return '[Fake Computed Style]';
          }))
        });
        return cajaVM.def(TameComputedStyle);  // and defends its prototype
      });

      tamingClassTable.registerLazy('XMLHttpRequest', function() {
        // Note: XMLHttpRequest is a ctor that *can* be directly
        // called by cajoled code, so we do not use inertCtor().
        return cajaVM.def(TameXMLHttpRequest(
            taming,
            rulebreaker,
            XMLHttpRequestCtor(
                makeDOMAccessible,
                makeFunctionAccessible(window.XMLHttpRequest),
                makeFunctionAccessible(window.ActiveXObject),
                makeFunctionAccessible(window.XDomainRequest)),
            naiveUriPolicy,
            function () { return domicile.pseudoLocation.href; }));
      });


      /**
       * Create a CSS stylesheet with the given text and append it to the DOM.
       * @param {string} cssText a well-formed stylesheet production.
       */
      domicile.emitCss = cajaVM.constFunc(function(cssText) {
        this.getCssContainer().appendChild(
            bridal.createStylesheet(document, cssText));
      });
      /** The node to which gadget stylesheets should be added. */
      domicile.getCssContainer = cajaVM.constFunc(function() {
        var e = document.getElementsByTagName('head')[0];
        e = makeDOMAccessible(e);
        return e;
      });
      domicile.tagPolicy = tagPolicy;  // used by CSS rewriter

      if (!/^-/.test(idSuffix)) {
        throw new Error('id suffix "' + idSuffix + '" must start with "-"');
      }
      if (!/___$/.test(idSuffix)) {
        throw new Error('id suffix "' + idSuffix + '" must end with "___"');
      }
      var idClass = idSuffix.substring(1);
      var idClassPattern = new RegExp(
          '(?:^|\\s)' + idClass.replace(/[\.$]/g, '\\$&') + '(?:\\s|$)');
      /**
       * Is this the node whose children are the children of the virtual
       * document?
       */
      function isContainerNode(node) {
        return node === containerNode ||
            (node &&
             node.nodeType === 1 &&
             idClassPattern.test(node.className));
      }
      /** A per-gadget class used to separate style rules. */
      domicile.getIdClass = cajaVM.constFunc(function() {
        return idClass;
      });
      // enforce id class on container
      if (containerNode.nodeType !== 9) {  // not a document (top level)
        bridal.setAttribute(containerNode, 'class',
            bridal.getAttribute(containerNode, 'class')
            + ' ' + idClass + ' vdoc-container___');
      }

      // bitmask of trace points
      //    0x0001 plugin_dispatchEvent
      domicile.domitaTrace = 0;
      domicile.getDomitaTrace = cajaVM.constFunc(
          function() { return domicile.domitaTrace; }
      );
      domicile.setDomitaTrace = cajaVM.constFunc(
          function(x) { domicile.domitaTrace = x; }
      );

      var TameWindowConf = new Confidence('TameWindow');

      /**
       * See http://www.whatwg.org/specs/web-apps/current-work/multipage/browsers.html#window for the full API.
       */
      function TameWindow(container) {
        TameWindowConf.confide(this, taming);
        TameWindowConf.amplify(this, function(privates) {
          privates.feralContainerNode = container;
          Object.preventExtensions(privates);
        });

        // These descriptors were chosen to resemble actual ES5-supporting browser
        // behavior.
        // The document property is defined below.
        installLocation(this);
        Object.defineProperty(this, "navigator", {
          value: tameNavigator,
          configurable: false,
          enumerable: true,
          writable: false
        });

        taming.permitUntaming(this);

        // Attach reflexive properties
        ['top', 'self', 'opener', 'parent', 'window'].forEach(function(prop) {
          this[prop] = this;
        }, this);
      }
      inertCtor(TameWindow, Object, 'Window');
      Props.define(TameWindow.prototype, TameWindowConf, {
        toString: Props.overridable(false, innocuous(function() {
          return '[domado object Window]';
        }))
      });
      // Methods of TameWindow are established later. TODO(kpreid): Revisit
      // whether that is necessary.

      tamingClassTable.registerLazy('Location', function() {
        // Location object -- used by Document and Window and so must be created
        // before each.
        function TameLocation() {
          // TODO(mikesamuel): figure out a mechanism by which the container can
          // specify the gadget's apparent URL.
          // See http://www.whatwg.org/specs/web-apps/current-work/multipage/history.html#location0
          var self = this;
          function defineLocationField(f, dflt) {
            Object.defineProperty(self, f, {
              configurable: false,
              enumerable: true,
              get: innocuous(function() {
                try {
                  var v = domicile.pseudoLocation[f];
                  return String(v !== null ? v : dflt);
                } catch (e) {
                  // paranoia - domicile.pseudoLocation is potentially
                  // replaceable by the host and could have wrong-frame code.
                  // TODO(kpreid): put pseudoLocation somewhere not writable.
                  throw tameException(e);
                }
              })
            });
          }
          defineLocationField('href', 'http://nosuchhost.invalid:80/');
          defineLocationField('hash', '');
          defineLocationField('host', 'nosuchhost.invalid:80');
          defineLocationField('hostname', 'nosuchhost.invalid');
          defineLocationField('pathname', '/');
          defineLocationField('port', '80');
          defineLocationField('protocol', 'http:');
          defineLocationField('search', '');
        }
        inertCtor(TameLocation, Object);
        setToString(TameLocation.prototype, innocuous(function() {
          return this.href;
        }));
        return cajaVM.def(TameLocation);  // and its prototype
      });

      // 'location' singleton
      var installLocation = (function() {
        var tameLocation;
        function tameLocationGetter() {
          if (!tameLocation) {
            tameLocation =
                new (tamingClassTable.getTamingCtor('Location'))();
          }
          return tameLocation;
        }
        cajaVM.constFunc(tameLocationGetter);
        function tameLocationSetter() {
          throw new Error('Caja does not currently support assigning to ' +
              '.location');
        }
        cajaVM.constFunc(tameLocationSetter);
        return function installLocation(obj) {
          Object.defineProperty(obj, 'location', {
            configurable: false,
            enumerable: true,
            get: tameLocationGetter,
            set: tameLocationSetter
          });
        };
      }());

      // See spec at http://www.whatwg.org/specs/web-apps/current-work/multipage/browsers.html#navigator
      // We don't attempt to hide or abstract userAgent details since
      // they are discoverable via side-channels we don't control.
      var navigator = makeDOMAccessible(window.navigator);
      var tameNavigator = cajaVM.def({
        appName: String(navigator.appName),
        appVersion: String(navigator.appVersion),
        platform: String(navigator.platform),
        // userAgent should equal the string sent in the User-Agent HTTP header.
        userAgent: String(navigator.userAgent),
        // Custom attribute indicating Caja is active.
        cajaVersion: '1.0'
        });

      /**
       * Set of allowed pseudo elements as described at
       * http://www.w3.org/TR/CSS2/selector.html#q20
       */
      var PSEUDO_ELEMENT_WHITELIST = {
        // after and before disallowed since they can leak information about
        // arbitrary ancestor nodes.
        'first-letter': true,
        'first-line': true
      };

      // Under ES53, the set/clear pairs get invoked with 'this' bound
      // to USELESS, which causes problems on Chrome unless they're wrapped
      // this way.
      tameSetAndClear(
          TameWindow.prototype,
          function (code, millis) { return window.setTimeout(code, millis); },
          function (id) { return window.clearTimeout(id); },
          'setTimeout', 'clearTimeout');
      tameSetAndClear(
          TameWindow.prototype,
          function (code, millis) { return window.setInterval(code, millis); },
          function (id) { return window.clearInterval(id); },
          'setInterval', 'clearInterval');
      var noopWindowFunctionProp = Props.markPropMaker(function(env) {
        var prop = env.prop;
        var notify = true;
        return {
          // Matches Firefox 17.0
          // Chrome 25.0.1329.0 canary has configurable:false
          configurable: true,
          enumerable: true,
          writable: true,
          value: innocuous(function domadoNoop() {
            if (notify) {
              notify = false;
              if (typeof console !== 'undefined') {
                console.warn('Domado: ignoring window.' + prop + '(\u2026).');
              }
            }
          })
        };
      });
      // Firefox's class name is (exported) BarProp, Chrome's is (nonexported)
      // BarInfo.
      // visible: false was chosen to reflect what the Caja environment
      // provides (e.g. there is no location bar displaying the URL), not
      // browser behavior (which, for Firefox, is to have .visible be false if
      // and only if the window was created by a window.open specifying that,
      // whether or not the relevant toolbar actually is hidden).
      var stubBarPropProp = Props.overridable(true,
          cajaVM.def({visible: false}));
      Props.define(TameWindow.prototype, TameWindowConf, {
        addEventListener: Props.plainMethod(
            function(name, listener, useCapture) {
          if (name === 'load') {
            ensureValidCallback(listener);
            nodeAmplify(tameDocument, function(privates) {
              privates.onLoadListeners.push(listener);
            });
          } else if (name === 'DOMContentLoaded') {
            ensureValidCallback(listener);
            nodeAmplify(tameDocument, function(privates) {
              privates.onDCLListeners.push(listener);
            });
          } else {
            // TODO: need a testcase for this
            tameDocument.addEventListener(name, listener, useCapture);
          }
        }),
        removeEventListener: Props.plainMethod(
            function (name, listener, useCapture) {
          if (name === 'load' || name === 'DOMContentLoaded') {
            var listeners = nodeAmplify(tameDocument, function(p) {
              // exception-safe export from amp - all objects are guest code
              return p[name === 'load' ? 'onLoadListeners' : 'onDCLListeners'];
            });
            var k = 0;
            for (var i = 0, n = listeners.length; i < n; ++i) {
              listeners[i - k] = listeners[+i];
              if (listeners[+i] === listener) {
                ++k;
              }
            }
            listeners.length -= k;
          } else {
            tameDocument.removeEventListener(name, listener, useCapture);
          }
        }),
        dispatchEvent: Props.plainMethod(function (evt) {
          // TODO(ihab.awad): Implement
        }),
        scrollBy: Props.ampMethod(function(privates, dx, dy) {
          // The window is always auto scrollable, so make the apparent window
          // body scrollable if the gadget tries to scroll it.
          if (dx || dy) {
            makeScrollable(bridal, privates.feralContainerNode);
          }
          tameScrollBy(privates.feralContainerNode, dx, dy);
        }),
        scrollTo: Props.ampMethod(function(privates, x, y) {
          // The window is always auto scrollable, so make the apparent window
          // body scrollable if the gadget tries to scroll it.
          makeScrollable(bridal, privates.feralContainerNode);
          tameScrollTo(privates.feralContainerNode, x, y);
        }),
        resizeTo: Props.ampMethod(function(privates, w, h) {
            tameResizeTo(privates.feralContainerNode, w, h);
        }),
        resizeBy: Props.ampMethod(function(privates, dw, dh) {
          tameResizeBy(privates.feralContainerNode, dw, dh);
        }),
        /** A partial implementation of getComputedStyle. */
        getComputedStyle: Props.plainMethod(
            // Pseudo elements are suffixes like :first-line which constrain to
            // a portion of the element's content as defined at
            // http://www.w3.org/TR/CSS2/selector.html#q20
            function(tameElement, pseudoElement) {
          return nodeAmplify(tameElement, function(elPriv) {
            // Coerce all nullish values to undefined, since that is the value
            // for unspecified parameters.
            // Per bug 973: pseudoElement should be null according to the
            // spec, but mozilla docs contradict this.
            // From https://developer.mozilla.org/En/DOM:window.getComputedStyle
            //     pseudoElt is a string specifying the pseudo-element to match.
            //     Should be an empty string for regular elements.
            pseudoElement = (pseudoElement === null || pseudoElement === void 0
                             || '' === pseudoElement)
                ? void 0 : String(pseudoElement).toLowerCase();
            if (pseudoElement !== void 0
                && !PSEUDO_ELEMENT_WHITELIST.hasOwnProperty(pseudoElement)) {
              throw new Error('Bad pseudo element ' + pseudoElement);
            }
            // No need to check editable since computed styles are readonly.
            return new (tamingClassTable.getTamingCtor(
                'CajaComputedCSSStyleDeclaration'))(
                elPriv.feral, pseudoElement);
          });
        }),
        pageXOffset: Props.alias(true, 'scrollX'),
        pageYOffset: Props.alias(true, 'scrollY'),
        scrollX: Props.ampGetter(function(p) {
            return p.feralContainerNode.scrollLeft; }),
        scrollY: Props.ampGetter(function(p) {
            return p.feralContainerNode.scrollTop; }),
        innerHeight: Props.ampGetter(function(p) {
            return p.feralContainerNode.offsetHeight; }),
        innerWidth: Props.ampGetter(function(p) {
            return p.feralContainerNode.offsetWidth; }),
        outerHeight: Props.ampGetter(function(p) {
            return p.feralContainerNode.offsetHeight; }),
        outerWidth: Props.ampGetter(function(p) {
            return p.feralContainerNode.offsetWidth; }),
        blur: noopWindowFunctionProp,
        focus: noopWindowFunctionProp,
        close: noopWindowFunctionProp,
        moveBy: noopWindowFunctionProp,
        moveTo: noopWindowFunctionProp,
        print: noopWindowFunctionProp,
        stop: noopWindowFunctionProp,
        locationbar: stubBarPropProp,
        personalbar: stubBarPropProp,
        menubar: stubBarPropProp,
        scrollbars: stubBarPropProp,
        statusbar: stubBarPropProp,
        toolbar: stubBarPropProp
      });
      // NOT PROVIDED on window:
      // event: a global on IE.  We always define it in scopes that can handle
      //        events.
      // opera: defined only on Opera.
      cajaVM.def(TameWindow);  // and its prototype

      // Declare we're done adding new exported classes.
      tamingClassTable.finish();

      var tameDocument = new TameHTMLDocument(
          document,
          containerNode,
          // TODO(jasvir): Properly wire up document.domain
          // by untangling the cyclic dependence between
          // TameWindow and TameDocument
          String(undefined || 'nosuchhost.invalid'));
      domicile.htmlEmitterTarget = containerNode;

      var tameWindow = new TameWindow(containerNode);




      if (nodeAmplify(tameDocument,
                      function(p) { return p.policy.editable; })) {
        // Powerful singleton authority not granted for RO document
        tameDocument.defaultView = tameWindow;

        // Hook for document.write support.
        domicile.sanitizeAttrs = sanitizeAttrs;
      }

      // Iterate over all node classes, assigning them to the Window object
      // under their DOM Level 2 standard name. They have been frozen above.
      tamingClassTable.exportTo(tameWindow);

      // TODO(ihab.awad): Build a more sophisticated virtual class hierarchy by
      // having a table of subclass relationships and implementing them.

      // If a node class name in this list is not defined using defineElement or
      // inertCtor above, then it will now be bound to the HTMLElement class.
      var allDomNodeClasses = htmlSchema.getAllKnownScriptInterfaces();
      for (var i = 0; i < allDomNodeClasses.length; i++) {
        var className = allDomNodeClasses[+i];
        if (!(className in tameWindow)) {
          Object.defineProperty(tameWindow, className, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: defaultNodeClassCtor
          });
        }
      }

      // Register [NamedConstructor]s
      Object.freeze(namedConstructors);  // catch initialization order errors
      Object.getOwnPropertyNames(namedConstructors).forEach(function(name) {
        Object.defineProperty(tameWindow, name, {
          enumerable: true,
          configurable: true,
          writable: true,
          value: namedConstructors[name]
        });
      });

      tameDocument = finishNode(tameDocument);

      domicile.window = tameWindow;
      domicile.document = tameDocument;
      Object.defineProperty(tameWindow, 'document', {
        value: tameDocument,
        configurable: false,
        enumerable: true,
        writable: false
      });

      pluginId = rulebreaker.getId(tameWindow);
      windowToDomicile.set(tameWindow, domicile);

      // Install virtual UA stylesheet.
      if (!document.caja_gadgetStylesheetInstalled) (function () {
        document.caja_gadgetStylesheetInstalled = true;
        
        var element = makeDOMAccessible(document.createElement("style"));
        element.setAttribute("type", "text/css");
        element.textContent = (
          // Visually contains the virtual document
          ".vdoc-container___ {" +
            "position:relative!important;" +
            "overflow:auto!important;" +
            "clip:rect(auto,auto,auto,auto)!important;" + // paranoia
          "}" +

          // Styles for HTML elements that we virtualize, and so do not get the
          // normal UA stylesheet rules applied:

          // Should be the intersection of HTML5 spec's list and our virtualized
          // (i.e. non-whitelisted) elements. Source:
          // <http://www.whatwg.org/specs/web-apps/current-work/multipage/rendering.html#the-css-user-agent-style-sheet-and-presentational-hints>
          "caja-v-base,caja-v-basefont,caja-v-head,caja-v-link,caja-v-meta," +
          "caja-v-noembed,caja-v-noframes,caja-v-param,caja-v-source," +
          "caja-v-track,caja-v-title{" +
            "display:none;" + 
          "}" +

          "caja-v-html, caja-v-body {" +
            "display:block;" +
          "}"
        );
        domicile.getCssContainer().appendChild(element);
      })();

      return domicile;
    }

    /**
     * Function called from rewritten event handlers to dispatch an event safely.
     */
    function plugin_dispatchEvent(thisNode, event, pluginId, handler,
          argCount) {
      var window = bridalMaker.getWindow(thisNode, makeDOMAccessible);
      event = makeDOMAccessible(event || window.event);
      // support currentTarget on IE[678]
      if (!event.currentTarget) {
        event.currentTarget = thisNode;
      }
      var imports = rulebreaker.getImports(pluginId);
      var domicile = windowToDomicile.get(imports);
      var node = domicile.tameNode(thisNode);
      var isUserAction = eventIsUserAction(event, window);
      try {
        return dispatch(
          isUserAction, pluginId, handler,
          [ node, domicile.tameEvent(event), node ].slice(0, argCount + 1));
      } catch (ex) {
        imports.onerror(ex.message, 'unknown', 0);
      }
    }

    /**
     * Return true if event is a user action that can be expected to do
     * click(), focus(), etc.
     */
    function eventIsUserAction(event, window) {
      if (!(event instanceof window.UIEvent)) { return false; }
      switch (event.type) {
        case 'click':
        case 'dblclick':
        case 'keypress':
        case 'keydown':
        case 'keyup':
        case 'mousedown':
        case 'mouseup':
        case 'touchstart':
        case 'touchend':
          return true;
      }
      return false;
    }

    /**
     * Called when user clicks on a javascript: link.
     */
    function plugin_dispatchToHandler(pluginId, handler, args) {
      return dispatch(true, pluginId, handler, args);
    }

    function dispatch(isUserAction, pluginId, handler, args) {
      var domicile = windowToDomicile.get(rulebreaker.getImports(pluginId));
      if (domicile.domitaTrace & 0x1 && typeof console != 'undefined') {
        var sig = ('' + handler).match(/^function\b[^\)]*\)/);
        console.log(
            'Dispatch pluginId=' + pluginId +
            ', handler=' + (sig ? sig[0] : handler) +
            ', args=' + args);
      }
      switch (typeof handler) {
        case 'number':
          handler = domicile.handlers[+handler];
          break;
        case 'string':
          var fn = void 0;
          fn = domicile.window[handler];
          handler = fn && typeof fn.call === 'function' ? fn : void 0;
          break;
        case 'function': case 'object': break;
        default:
          throw new Error(
              'Expected function as event handler, not ' + typeof handler);
      }
      domicile.handlingUserAction = isUserAction;
      try {
        return handler.call.apply(handler, args);
      } catch (ex) {
        // guard against IE discarding finally blocks
        domicile.handlingUserAction = false;
        throw ex;
      } finally {
        domicile.handlingUserAction = false;
      }
    }

    return cajaVM.def({
      attachDocument: attachDocument,
      plugin_dispatchEvent: plugin_dispatchEvent,
      plugin_dispatchToHandler: plugin_dispatchToHandler,
      getDomicileForWindow: windowToDomicile.get.bind(windowToDomicile)
    });
  });
})();

// Exports for closure compiler.
if (typeof window !== 'undefined') {
  window['Domado'] = Domado;
}
