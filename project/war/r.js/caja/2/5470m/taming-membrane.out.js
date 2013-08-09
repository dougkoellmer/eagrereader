{
  ___.loadModule({
      'instantiate': function (___, IMPORTS___) {
        var dis___ = IMPORTS___;
        var moduleResult___;
        {
          function TamingMembrane(privilegedAccess, schema) {
            var feralByTame, tameByFeral, x0___, x1___, x2___, x3___, x4___,
            x5___, isNumericName, preventExtensions, applyFeralFunction,
            applyTameFunction, getFeralProperty, setFeralProperty,
            getTameProperty, setTameProperty, copyBuiltin,
            makeNeutralException, tameException, untameException, tamesTo,
            reTamesTo, tameArray, untameArray, errGet, errSet, tame,
            isValidPropertyName, tameRecord, tamePreviouslyConstructedObject,
            addFunctionPropertyHandlers, tamePureFunction, tameCtor, tameXo4a,
            makePrototypeMethod, makeStrictPrototypeMethod, inheritsFrom,
            makePropertyGetter, makePropertySetter, defineObjectProperty,
            tameObjectWithMethods, untame, untameCajaFunction,
            untameCajaRecord, untameCajaRecordByEvisceration,
            untameCajaRecordByPropertyHandlers, hasTameTwin, hasFeralTwin,
            x6___, x7___;
            {
              function isNumericName(n) {
                return typeof n === 'number' || '' + +n === n;
              }
              ___.f(isNumericName, 'isNumericName');
            }
            {
              function preventExtensions(o) {
                var x0___, x1___;
                return void 0 === o? void 0: (x0___ = IMPORTS___.Object_v___?
                  IMPORTS___.Object: ___.ri(IMPORTS___, 'Object'), x1___ = o,
                  x0___.preventExtensions_m___? x0___.preventExtensions(x1___):
                  x0___.m___('preventExtensions', [ x1___ ]));
              }
              ___.f(preventExtensions, 'preventExtensions');
            }
            {
              function applyFeralFunction(feralFunction, feralThis,
                feralArguments) {
                try {
                  return tame.i___(schema.applyFeralFunction_m___?
                    schema.applyFeralFunction(feralFunction, feralThis,
                      feralArguments): schema.m___('applyFeralFunction', [
                        feralFunction, feralThis, feralArguments ]));
                } catch (e) {
                  throw tameException.i___(e);
                }
              }
              ___.f(applyFeralFunction, 'applyFeralFunction');
            }
            {
              function applyTameFunction(tameFunction, tameThis, tameArguments)
                {
                try {
                  return untame.i___(tameFunction.apply_m___?
                    tameFunction.apply(tameThis, tameArguments):
                    tameFunction.m___('apply', [ tameThis, tameArguments ]));
                } catch (e) {
                  throw untameException.i___(e);
                }
              }
              ___.f(applyTameFunction, 'applyTameFunction');
            }
            {
              function getFeralProperty(feralObject, feralProp) {
                try {
                  return tame.i___(privilegedAccess.getProperty_m___?
                    privilegedAccess.getProperty(feralObject, feralProp):
                    privilegedAccess.m___('getProperty', [ feralObject,
                        feralProp ]));
                } catch (e) {
                  throw tameException.i___(e);
                }
              }
              ___.f(getFeralProperty, 'getFeralProperty');
            }
            {
              function setFeralProperty(feralObject, feralProp, feralValue) {
                try {
                  privilegedAccess.setProperty_m___?
                    privilegedAccess.setProperty(feralObject, feralProp,
                    feralValue): privilegedAccess.m___('setProperty', [
                      feralObject, feralProp, feralValue ]);
                } catch (e) {
                  throw tameException.i___(e);
                }
              }
              ___.f(setFeralProperty, 'setFeralProperty');
            }
            {
              function getTameProperty(tameObject, tameProp) {
                try {
                  return untame.i___(tameObject.v___(tameProp));
                } catch (e) {
                  throw untameException.i___(e);
                }
              }
              ___.f(getTameProperty, 'getTameProperty');
            }
            {
              function setTameProperty(tameObject, tameProp, tameValue) {
                try {
                  tameObject.w___(tameProp, tameValue);
                } catch (e) {
                  throw untameException.i___(e);
                }
              }
              ___.f(setTameProperty, 'setTameProperty');
            }
            {
              function copyBuiltin(o) {
                var t, x0___, x1___, x2___, x3___, msg, name, x4___, x5___;
                t = void 0;
                switch (x2___ = (x1___ = (x0___ = IMPORTS___.Object_v___?
                      IMPORTS___.Object: ___.ri(IMPORTS___, 'Object'),
                      x0___.prototype_v___? x0___.prototype:
                      x0___.v___('prototype')), x1___.toString_v___?
                    x1___.toString: x1___.v___('toString')), x3___ = o,
                  x2___.call_m___? x2___.call(x3___): x2___.m___('call', [
                      x3___ ])) {
                case '[object Boolean]':
                  t = new (IMPORTS___.Boolean_v___? IMPORTS___.Boolean:
                    ___.ri(IMPORTS___, 'Boolean'))
                    .new___((privilegedAccess.getValueOf_m___?
                      privilegedAccess.getValueOf(o):
                      privilegedAccess.m___('getValueOf', [ o ])));
                  break;
                case '[object Date]':
                  t = new (IMPORTS___.Date_v___? IMPORTS___.Date:
                    ___.ri(IMPORTS___, 'Date'))
                    .new___((privilegedAccess.getValueOf_m___?
                      privilegedAccess.getValueOf(o):
                      privilegedAccess.m___('getValueOf', [ o ])));
                  break;
                case '[object Number]':
                  t = new (IMPORTS___.Number_v___? IMPORTS___.Number:
                    ___.ri(IMPORTS___, 'Number'))
                    .new___((privilegedAccess.getValueOf_m___?
                      privilegedAccess.getValueOf(o):
                      privilegedAccess.m___('getValueOf', [ o ])));
                  break;
                case '[object RegExp]':
                  t = new (IMPORTS___.RegExp_v___? IMPORTS___.RegExp:
                    ___.ri(IMPORTS___, 'RegExp'))
                    .new___((privilegedAccess.getProperty_m___?
                      privilegedAccess.getProperty(o, 'source'):
                      privilegedAccess.m___('getProperty', [ o, 'source' ])),
                    (((privilegedAccess.getProperty_m___?
                       privilegedAccess.getProperty(o, 'global'):
                       privilegedAccess.m___('getProperty', [ o, 'global' ])) ?
                      'g': '') + ((privilegedAccess.getProperty_m___?
                         privilegedAccess.getProperty(o, 'ignoreCase'):
                         privilegedAccess.m___('getProperty', [ o, 'ignoreCase'
                           ])) ? 'i': '') +
                     ((privilegedAccess.getProperty_m___?
                       privilegedAccess.getProperty(o, 'multiline'):
                       privilegedAccess.m___('getProperty', [ o, 'multiline' ])
                      ) ? 'm': '')));
                  break;
                case '[object String]':
                  t = new (IMPORTS___.String_v___? IMPORTS___.String:
                    ___.ri(IMPORTS___, 'String'))
                    .new___((privilegedAccess.getValueOf_m___?
                      privilegedAccess.getValueOf(o):
                      privilegedAccess.m___('getValueOf', [ o ])));
                  break;
                case '[object Error]':
                  msg = '' + (privilegedAccess.getProperty_m___?
                    privilegedAccess.getProperty(o, 'message'):
                    privilegedAccess.m___('getProperty', [ o, 'message' ]));
                  name = privilegedAccess.getProperty_m___?
                    privilegedAccess.getProperty(o, 'name'):
                  privilegedAccess.m___('getProperty', [ o, 'name' ]);
                  switch (name) {
                  case 'Error':
                    t = new (IMPORTS___.Error_v___? IMPORTS___.Error:
                      ___.ri(IMPORTS___, 'Error')).new___(msg);
                    break;
                  case 'EvalError':
                    t = new (IMPORTS___.EvalError_v___? IMPORTS___.EvalError:
                      ___.ri(IMPORTS___, 'EvalError')).new___(msg);
                    break;
                  case 'RangeError':
                    t = new (IMPORTS___.RangeError_v___? IMPORTS___.RangeError:
                      ___.ri(IMPORTS___, 'RangeError')).new___(msg);
                    break;
                  case 'ReferenceError':
                    t = new (IMPORTS___.ReferenceError_v___?
                      IMPORTS___.ReferenceError: ___.ri(IMPORTS___,
                        'ReferenceError')).new___(msg);
                    break;
                  case 'SyntaxError':
                    t = new (IMPORTS___.SyntaxError_v___?
                      IMPORTS___.SyntaxError: ___.ri(IMPORTS___, 'SyntaxError')
                    ).new___(msg);
                    break;
                  case 'TypeError':
                    t = new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                      ___.ri(IMPORTS___, 'TypeError')).new___(msg);
                    break;
                  case 'URIError':
                    t = new (IMPORTS___.URIError_v___? IMPORTS___.URIError:
                      ___.ri(IMPORTS___, 'URIError')).new___(msg);
                    break;
                  default:
                    t = new (IMPORTS___.Error_v___? IMPORTS___.Error:
                      ___.ri(IMPORTS___, 'Error')).new___(msg);
                    x5___ = t, x4___ = '' + name, x5___.name_w___ === x5___?
                      (x5___.name = x4___): x5___.w___('name', x4___);
                    break;
                  }
                }
                return t;
              }
              ___.f(copyBuiltin, 'copyBuiltin');
            }
            {
              function makeNeutralException(e) {
                var str;
                str = 'Error';
                try {
                  str = e.toString_m___? e.toString(): e.m___('toString', [ ]);
                } catch (ex) {}
                return new (IMPORTS___.Error_v___? IMPORTS___.Error:
                  ___.ri(IMPORTS___, 'Error')).new___(str);
              }
              ___.f(makeNeutralException, 'makeNeutralException');
            }
            {
              function tameException(f) {
                var t;
                t = void 0;
                try {
                  t = tame.i___(f);
                } catch (e) {}
                if (t !== void 0) { return t; }
                return makeNeutralException.i___(f);
              }
              ___.f(tameException, 'tameException');
            }
            {
              function untameException(t) {
                var f;
                f = void 0;
                try {
                  f = untame.i___(t);
                } catch (e) {}
                if (f !== void 0) { return f; }
                return makeNeutralException.i___(t);
              }
              ___.f(untameException, 'untameException');
            }
            {
              function tamesTo(f, t) {
                var et, ef;
                if (f && (tameByFeral.has_m___? tameByFeral.has(f):
                    tameByFeral.m___('has', [ f ])) || t &&
                  (feralByTame.has_m___? feralByTame.has(t):
                   feralByTame.m___('has', [ t ]))) {
                  et = tameByFeral.get_m___? tameByFeral.get(f):
                  tameByFeral.m___('get', [ f ]);
                  ef = feralByTame.get_m___? feralByTame.get(t):
                  feralByTame.m___('get', [ t ]);
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Attempt to multiply tame: ' + f + (ef?
                        ' (already ' + (ef === f? 'same': ef) + ')': '') +
                      ' \x3c-\x3e ' + t + (et? ' (already ' + (et === t?
                          'same': et) + ')': '')));
                }
                reTamesTo.i___(f, t);
              }
              ___.f(tamesTo, 'tamesTo');
            }
            {
              function reTamesTo(f, t) {
                var ftype, ttype;
                ftype = typeof f;
                if (!f || ftype !== 'function' && ftype !== 'object') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___('Unexpected feral primitive: ', f);
                }
                ttype = typeof t;
                if (!t || ttype !== 'function' && ttype !== 'object') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___('Unexpected tame primitive: ', t);
                }
                tameByFeral.set_m___? tameByFeral.set(f, t):
                tameByFeral.m___('set', [ f, t ]);
                feralByTame.set_m___? feralByTame.set(t, f):
                feralByTame.m___('set', [ t, f ]);
                schema.fix_m___? schema.fix(f): schema.m___('fix', [ f ]);
              }
              ___.f(reTamesTo, 'reTamesTo');
            }
            {
              function tameArray(fa) {
                var ta, i, x0___, x1___, x2___, x3___;
                ta = [ ];
                for (i = 0; i < fa.length; i++) {
                  x1___ = ta, x0___ =
                    tame.i___(privilegedAccess.getProperty_m___?
                    privilegedAccess.getProperty(fa, i):
                    privilegedAccess.m___('getProperty', [ fa, i ])),
                  x1___.NUM____w___ === x1___? (x1___[ +i ] = x0___):
                  x1___.w___(+i, x0___);
                }
                return x2___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x3___ = ta, x2___.freeze_m___?
                  x2___.freeze(x3___): x2___.m___('freeze', [ x3___ ]);
              }
              ___.f(tameArray, 'tameArray');
            }
            {
              function untameArray(ta) {
                var fa, i, x0___, x1___, x2___, x3___, x4___, x5___;
                fa = [ ];
                for (i = 0; i < ta.length; i++) {
                  x1___ = privilegedAccess, x2___ = fa, x3___ = i, x0___ =
                    untame.i___(ta[ +i ]), x1___.setProperty_m___?
                    x1___.setProperty(x2___, x3___, x0___):
                  x1___.m___('setProperty', [ x2___, x3___, x0___ ]);
                }
                return x4___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x5___ = fa, x4___.freeze_m___?
                  x4___.freeze(x5___): x4___.m___('freeze', [ x5___ ]);
              }
              ___.f(untameArray, 'untameArray');
            }
            {
              function errGet(p) {
                var x0___, x1___;
                return x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x1___ = ___.f(function () {
                    throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                      ___.ri(IMPORTS___, 'TypeError'))
                      .new___(('Unreadable property: ' + p));
                  }), x0___.freeze_m___? x0___.freeze(x1___):
                x0___.m___('freeze', [ x1___ ]);
              }
              ___.f(errGet, 'errGet');
            }
            {
              function errSet(p) {
                var x0___, x1___;
                return x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x1___ = ___.f(function () {
                    throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                      ___.ri(IMPORTS___, 'TypeError'))
                      .new___(('Unwriteable property: ' + p));
                  }), x0___.freeze_m___? x0___.freeze(x1___):
                x0___.m___('freeze', [ x1___ ]);
              }
              ___.f(errSet, 'errSet');
            }
            {
              function tame(f) {
                var ftype, x0___, x1___, t, ctor, x2___, x3___, x4___, x5___,
                x6___, x7___, x8___, x9___, x10___, x11___, x12___, x13___,
                x14___;
                if (f !== (IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object')).i___(f)) { return f; }
                ftype = typeof f;
                if (x0___ = IMPORTS___.Array_v___? IMPORTS___.Array:
                  ___.ri(IMPORTS___, 'Array'), x1___ = f, x0___.isArray_m___?
                  x0___.isArray(x1___): x0___.m___('isArray', [ x1___ ])) {
                  return tameArray.i___(f);
                }
                t = tameByFeral.get_m___? tameByFeral.get(f):
                tameByFeral.m___('get', [ f ]);
                if (t) { return t; }
                if (feralByTame.has_m___? feralByTame.has(f):
                  feralByTame.m___('has', [ f ])) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Tame object found on feral side of taming membrane: '
                        + f +
                        '. The membrane has previously been compromised.'));
                }
                if (ftype === 'object') {
                  ctor = privilegedAccess.directConstructor_m___?
                    privilegedAccess.directConstructor(f):
                  privilegedAccess.m___('directConstructor', [ f ]);
                  if (ctor === void 0) {
                    throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                      ___.ri(IMPORTS___, 'TypeError'))
                      .new___(('Cannot determine ctor of: ' + f));
                  } else if (ctor ===
                    (privilegedAccess.BASE_OBJECT_CONSTRUCTOR_v___?
                     privilegedAccess.BASE_OBJECT_CONSTRUCTOR:
                     privilegedAccess.v___('BASE_OBJECT_CONSTRUCTOR'))) {
                    t = preventExtensions.i___(tameRecord.i___(f));
                  } else {
                    t = copyBuiltin.i___(f);
                    if (t === void 0) {
                      t = tamePreviouslyConstructedObject.i___(f, ctor);
                    }
                  }
                } else if (ftype === 'function') {
                  switch (x2___ = schema.tameAs_v___? schema.tameAs:
                    schema.v___('tameAs'), x3___ = f, x2___.get_m___?
                    x2___.get(x3___): x2___.m___('get', [ x3___ ])) {
                  case x4___ = schema.tameTypes_v___? schema.tameTypes:
                    schema.v___('tameTypes'), x4___.CONSTRUCTOR_v___?
                      x4___.CONSTRUCTOR: x4___.v___('CONSTRUCTOR'):
                    t = tameCtor.i___(f, (x5___ = schema.tameCtorSuper_v___?
                        schema.tameCtorSuper: schema.v___('tameCtorSuper'),
                        x6___ = f, x5___.get_m___? x5___.get(x6___):
                        x5___.m___('get', [ x6___ ])), (x7___ =
                        schema.tameFunctionName_v___? schema.tameFunctionName:
                        schema.v___('tameFunctionName'), x8___ = f,
                        x7___.get_m___? x7___.get(x8___): x7___.m___('get', [
                            x8___ ])));
                    break;
                  case x9___ = schema.tameTypes_v___? schema.tameTypes:
                    schema.v___('tameTypes'), x9___.FUNCTION_v___?
                      x9___.FUNCTION: x9___.v___('FUNCTION'):
                    t = tamePureFunction.i___(f, (x10___ =
                        schema.tameFunctionName_v___? schema.tameFunctionName:
                        schema.v___('tameFunctionName'), x11___ = f,
                        x10___.get_m___? x10___.get(x11___): x10___.m___('get',
                          [ x11___ ])));
                    break;
                  case x12___ = schema.tameTypes_v___? schema.tameTypes:
                    schema.v___('tameTypes'), x12___.XO4A_v___? x12___.XO4A:
                    x12___.v___('XO4A'):
                    t = tameXo4a.i___(f, (x13___ =
                        schema.tameFunctionName_v___? schema.tameFunctionName:
                        schema.v___('tameFunctionName'), x14___ = f,
                        x13___.get_m___? x13___.get(x14___): x13___.m___('get',
                          [ x14___ ])));
                    break;
                  default:
                    t = void 0;
                    break;
                  }
                }
                if (t) {
                  privilegedAccess.banNumerics_m___?
                    privilegedAccess.banNumerics(t):
                  privilegedAccess.m___('banNumerics', [ t ]);
                  tamesTo.i___(f, t);
                }
                return t;
              }
              ___.f(tame, 'tame');
            }
            {
              function isValidPropertyName(p) {
                var x0___, x1___;
                return ! (x0___ = new RegExp.new___('.*__$'), x1___ = p,
                  x0___.test_m___? x0___.test(x1___): x0___.m___('test', [
                      x1___ ]));
              }
              ___.f(isValidPropertyName, 'isValidPropertyName');
            }
            {
              function tameRecord(f, t) {
                var readOnly, x0___, x1___, x2___, x3___, x4___;
                if (!t) {
                  t = ___.iM([ ]);
                }
                readOnly = (x0___ = schema.tameAs_v___? schema.tameAs:
                  schema.v___('tameAs'), x1___ = f, x0___.get_m___?
                  x0___.get(x1___): x0___.m___('get', [ x1___ ])) === (x2___ =
                  schema.tameTypes_v___? schema.tameTypes:
                  schema.v___('tameTypes'), x2___.READ_ONLY_RECORD_v___?
                  x2___.READ_ONLY_RECORD: x2___.v___('READ_ONLY_RECORD'));
                x3___ = privilegedAccess.getOwnPropertyNames_m___?
                  privilegedAccess.getOwnPropertyNames(f):
                privilegedAccess.m___('getOwnPropertyNames', [ f ]), x4___ =
                  ___.f(function (p) {
                    var get, set, x0___, x1___, x2___, x3___;
                    if (isNumericName.i___(p)) { return; }
                    if (!isValidPropertyName.i___(p)) { return; }
                    get = (function () {
                        function get$_var() {
                          return getFeralProperty.i___(f, p);
                        }
                        return ___.f(get$_var, 'get$_var');
                      })();
                    set = readOnly? IMPORTS___.undefined_v___?
                      IMPORTS___.undefined: ___.ri(IMPORTS___, 'undefined'):
                    ___.f(function (v) {
                        setFeralProperty.i___(f, p, untame.i___(v));
                        return v;
                      });
                    x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object'), x2___ = t, x3___ = p, x1___ =
                      ___.iM([ 'enumerable', true, 'configurable', false,
                        'get', get, 'set', set? set: errSet.i___(p) ]),
                    x0___.defineProperty_m___? x0___.defineProperty(x2___,
                      x3___, x1___): x0___.m___('defineProperty', [ x2___,
                        x3___, x1___ ]);
                  }), x3___.forEach_m___? x3___.forEach(x4___):
                x3___.m___('forEach', [ x4___ ]);
                return t;
              }
              ___.f(tameRecord, 'tameRecord');
            }
            {
              function tamePreviouslyConstructedObject(f, fc) {
                var x0___, x1___, x2___, tc, t, x3___, x4___;
                if ((x0___ = schema.tameAs_v___? schema.tameAs:
                    schema.v___('tameAs'), x1___ = fc, x0___.get_m___?
                    x0___.get(x1___): x0___.m___('get', [ x1___ ])) !== (x2___
                    = schema.tameTypes_v___? schema.tameTypes:
                    schema.v___('tameTypes'), x2___.CONSTRUCTOR_v___?
                    x2___.CONSTRUCTOR: x2___.v___('CONSTRUCTOR'))) { return void 0; }
                tc = tame.i___(fc);
                t = (x3___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                  ___.ri(IMPORTS___, 'Object'), x4___ = tc.prototype_v___?
                  tc.prototype: tc.v___('prototype'), x3___.create_m___?
                  x3___.create(x4___): x3___.m___('create', [ x4___ ]));
                tameObjectWithMethods.i___(f, t);
                return t;
              }
              ___.f(tamePreviouslyConstructedObject,
                'tamePreviouslyConstructedObject');
            }
            {
              function addFunctionPropertyHandlers(f, t) {
                var x0___, x1___, x2___, x3___;
                x2___ = (x0___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x1___ = f, x0___.getProps_m___?
                  x0___.getProps(x1___): x0___.m___('getProps', [ x1___ ])),
                x3___ = ___.f(function (p) {
                    var get, x0___, x1___, x2___, x3___, x4___, set, x5___,
                    x6___, x7___, x8___, x9___, x10___, x11___, x12___, x13___;
                    if (!isValidPropertyName.i___(p)) { return; }
                    get = ! (x0___ = schema.grantAs_v___? schema.grantAs:
                      schema.v___('grantAs'), x3___ = f, x4___ = p, x2___ =
                      (x1___ = schema.grantTypes_v___? schema.grantTypes:
                       schema.v___('grantTypes'), x1___.READ_v___? x1___.READ:
                       x1___.v___('READ')), x0___.has_m___? x0___.has(x3___,
                        x4___, x2___): x0___.m___('has', [ x3___, x4___, x2___
                        ])) ? IMPORTS___.undefined_v___? IMPORTS___.undefined:
                    ___.ri(IMPORTS___, 'undefined'): ___.f(function () {
                        return getFeralProperty.i___(f, p);
                      });
                    set = ! (x5___ = schema.grantAs_v___? schema.grantAs:
                      schema.v___('grantAs'), x8___ = f, x9___ = p, x7___ =
                      (x6___ = schema.grantTypes_v___? schema.grantTypes:
                       schema.v___('grantTypes'), x6___.WRITE_v___?
                       x6___.WRITE: x6___.v___('WRITE')), x5___.has_m___?
                      x5___.has(x8___, x9___, x7___): x5___.m___('has', [
                          x8___, x9___, x7___ ])) ? IMPORTS___.undefined_v___?
                      IMPORTS___.undefined: ___.ri(IMPORTS___, 'undefined'):
                    ___.f(function (v) {
                        setFeralProperty.i___(f, p, untame.i___(v));
                        return v;
                      });
                    if (get || set) {
                      x10___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                      ___.ri(IMPORTS___, 'Object'), x12___ = t, x13___ = p,
                      x11___ = ___.iM([ 'enumerable', true, 'configurable',
                          false, 'get', get? get: errGet.i___(p), 'set', set?
                            set: errSet.i___(p) ]), x10___.defineProperty_m___?
                        x10___.defineProperty(x12___, x13___, x11___):
                      x10___.m___('defineProperty', [ x12___, x13___, x11___ ])
                        ;
                    }
                  }), x2___.forEach_m___? x2___.forEach(x3___):
                x2___.m___('forEach', [ x3___ ]);
              }
              ___.f(addFunctionPropertyHandlers, 'addFunctionPropertyHandlers')
                ;
            }
            {
              function tamePureFunction(f) {
                var t;
                t = (function () {
                    function t$_var(_) {
                      {
                        ___.deodorize(arguments, -6);
                        var a___ = ___.args(arguments);
                      }
                      return applyFeralFunction.i___(f,
                        privilegedAccess.USELESS_v___?
                        privilegedAccess.USELESS:
                        privilegedAccess.v___('USELESS'),
                        untameArray.i___(a___));
                    }
                    return ___.f(t$_var, 't$_var');
                  })();
                addFunctionPropertyHandlers.i___(f, t);
                preventExtensions.i___(t);
                return t;
              }
              ___.f(tamePureFunction, 'tamePureFunction');
            }
            {
              function tameCtor(f, fSuper, name) {
                var fPrototype, t, tPrototype, x0___, x1___, x2___, x3___,
                x4___, x5___, x6___;
                fPrototype = privilegedAccess.getProperty_m___?
                  privilegedAccess.getProperty(f, 'prototype'):
                privilegedAccess.m___('getProperty', [ f, 'prototype' ]);
                t = (function () {
                    function t$_var(_) {
                      {
                        ___.deodorize(arguments, -6);
                        var a___ = ___.args(arguments);
                      }
                      var dis___ = this && this.___? void 0: this;
                      var o, x0___, x1___;
                      if (! (dis___ instanceof t)) {
                        return applyFeralFunction.i___(f,
                          privilegedAccess.USELESS_v___?
                          privilegedAccess.USELESS:
                          privilegedAccess.v___('USELESS'),
                          untameArray.i___(a___));
                      } else {
                        o = (x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                          ___.ri(IMPORTS___, 'Object'), x1___ = fPrototype,
                          x0___.create_m___? x0___.create(x1___):
                          x0___.m___('create', [ x1___ ]));
                        applyFeralFunction.i___(f, o, untameArray.i___(a___));
                        tameObjectWithMethods.i___(o, dis___);
                        tamesTo.i___(o, dis___);
                        privilegedAccess.banNumerics_m___?
                          privilegedAccess.banNumerics(dis___):
                        privilegedAccess.m___('banNumerics', [ dis___ ]);
                      }
                    }
                    return ___.f(t$_var, 't$_var');
                  })();
                if (tameByFeral.get_m___? tameByFeral.get(fPrototype):
                  tameByFeral.m___('get', [ fPrototype ])) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Prototype of constructor ' + f +
                        ' has already been tamed'));
                }
                tameRecord.i___(f, t);
                tPrototype = ___.f(function () {
                    var x0___, x1___, x2___, tSuper, x3___, x4___;
                    if (!fSuper || fSuper ===
                      (privilegedAccess.getObjectCtorFor_m___?
                       privilegedAccess.getObjectCtorFor(fSuper):
                       privilegedAccess.m___('getObjectCtorFor', [ fSuper ])))
                      {
                      return ___.iM([ ]);
                    }
                    if (! (x0___ = schema.tameAs_v___? schema.tameAs:
                        schema.v___('tameAs'), x1___ = fSuper, x0___.get_m___?
                        x0___.get(x1___): x0___.m___('get', [ x1___ ])) ===
                      (x2___ = schema.tameTypes_v___? schema.tameTypes:
                       schema.v___('tameTypes'), x2___.CONSTRUCTOR_v___?
                       x2___.CONSTRUCTOR: x2___.v___('CONSTRUCTOR'))) {
                      throw new (IMPORTS___.TypeError_v___?
                        IMPORTS___.TypeError: ___.ri(IMPORTS___, 'TypeError'))
                        .new___(('Super ctor ' + fSuper +
                            ' not granted as such'));
                    }
                    tSuper = tame.i___(fSuper);
                    return x3___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object'), x4___ =
                      tSuper.prototype_v___? tSuper.prototype:
                    tSuper.v___('prototype'), x3___.create_m___?
                      x3___.create(x4___): x3___.m___('create', [ x4___ ]);
                  }).i___();
                tameObjectWithMethods.i___(fPrototype, tPrototype);
                x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x2___ = tPrototype, x1___ =
                  ___.iM([ 'writable', false, 'configurable', false,
                    'enumerable', true, 'value', t ]),
                x0___.defineProperty_m___? x0___.defineProperty(x2___,
                  'constructor', x1___): x0___.m___('defineProperty', [ x2___,
                    'constructor', x1___ ]);
                privilegedAccess.banNumerics_m___?
                  privilegedAccess.banNumerics(tPrototype):
                privilegedAccess.m___('banNumerics', [ tPrototype ]);
                x3___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x4___ = tPrototype,
                x3___.freeze_m___? x3___.freeze(x4___): x3___.m___('freeze', [
                    x4___ ]);
                tamesTo.i___(fPrototype, tPrototype);
                t.prototype_w___ === t? (t.prototype = tPrototype):
                t.w___('prototype', tPrototype);
                x5___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x6___ = t, x5___.freeze_m___?
                  x5___.freeze(x6___): x5___.m___('freeze', [ x6___ ]);
                return t;
              }
              ___.f(tameCtor, 'tameCtor');
            }
            {
              function tameXo4a(f) {
                var t;
                t = (function () {
                    function t$_var(_) {
                      {
                        ___.deodorize(arguments, -6);
                        var a___ = ___.args(arguments);
                      }
                      var dis___ = this && this.___? void 0: this;
                      return applyFeralFunction.i___(f, untame.i___(dis___),
                        untameArray.i___(a___));
                    }
                    return ___.f(t$_var, 't$_var');
                  })();
                addFunctionPropertyHandlers.i___(f, t);
                preventExtensions.i___(t);
                return t;
              }
              ___.f(tameXo4a, 'tameXo4a');
            }
            {
              function makePrototypeMethod(proto, func) {
                return ___.f(function (_) {
                    {
                      ___.deodorize(arguments, -6);
                      var a___ = ___.args(arguments);
                    }
                    var dis___ = this && this.___? void 0: this;
                    if (!inheritsFrom.i___(dis___, proto)) {
                      throw new (IMPORTS___.TypeError_v___?
                        IMPORTS___.TypeError: ___.ri(IMPORTS___, 'TypeError'))
                        .new___(('Target object not permitted: ' + dis___));
                    }
                    return func.apply_m___? func.apply(dis___, a___):
                    func.m___('apply', [ dis___, a___ ]);
                  });
              }
              ___.f(makePrototypeMethod, 'makePrototypeMethod');
            }
            {
              function makeStrictPrototypeMethod(proto, func) {
                return ___.f(function (_) {
                    {
                      ___.deodorize(arguments, -6);
                      var a___ = ___.args(arguments);
                    }
                    var dis___ = this && this.___? void 0: this;
                    if (dis___ === proto || !inheritsFrom.i___(dis___, proto))
                      {
                      throw new (IMPORTS___.TypeError_v___?
                        IMPORTS___.TypeError: ___.ri(IMPORTS___, 'TypeError'))
                        .new___(('Target object not permitted: ' + dis___));
                    }
                    return func.apply_m___? func.apply(dis___, a___):
                    func.m___('apply', [ dis___, a___ ]);
                  });
              }
              ___.f(makeStrictPrototypeMethod, 'makeStrictPrototypeMethod');
            }
            {
              function inheritsFrom(o, proto) {
                var x0___, x1___;
                while (o) {
                  if (o === proto) { return true; }
                  o = (x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object'), x1___ = o,
                    x0___.getPrototypeOf_m___? x0___.getPrototypeOf(x1___):
                    x0___.m___('getPrototypeOf', [ x1___ ]));
                }
                return false;
              }
              ___.f(inheritsFrom, 'inheritsFrom');
            }
            {
              function makePropertyGetter(f, t, p) {
                var x0___, x1___, x2___, x3___, x4___, x5___, x6___, x7___,
                x8___, x9___;
                if (x0___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x3___ = f, x4___ = p, x2___ = (x1___
                    = schema.grantTypes_v___? schema.grantTypes:
                    schema.v___('grantTypes'), x1___.METHOD_v___? x1___.METHOD:
                    x1___.v___('METHOD')), x0___.has_m___? x0___.has(x3___,
                    x4___, x2___): x0___.m___('has', [ x3___, x4___, x2___ ]))
                  {
                  return makePrototypeMethod.i___(t, ___.f(function () {
                        var dis___ = this && this.___? void 0: this;
                        var self;
                        self = dis___;
                        return ___.f(function (_) {
                            {
                              ___.deodorize(arguments, -6);
                              var a___ = ___.args(arguments);
                            }
                            var x0___, x1___, x2___;
                            return applyFeralFunction.i___((x1___ =
                                privilegedAccess, x0___ = untame.i___(self),
                                x2___ = p, x1___.getProperty_m___?
                                x1___.getProperty(x0___, x2___):
                                x1___.m___('getProperty', [ x0___, x2___ ])),
                              untame.i___(self), untameArray.i___(a___));
                          });
                      }));
                } else if (x5___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x8___ = f, x9___ = p, x7___ = (x6___
                    = schema.grantTypes_v___? schema.grantTypes:
                    schema.v___('grantTypes'), x6___.READ_v___? x6___.READ:
                    x6___.v___('READ')), x5___.has_m___? x5___.has(x8___,
                    x9___, x7___): x5___.m___('has', [ x8___, x9___, x7___ ]))
                  {
                  return makePrototypeMethod.i___(t, ___.f(function () {
                        var dis___ = this && this.___? void 0: this;
                        return getFeralProperty.i___(untame.i___(dis___), p);
                      }));
                } else {
                  return IMPORTS___.undefined_v___? IMPORTS___.undefined:
                  ___.ri(IMPORTS___, 'undefined');
                }
              }
              ___.f(makePropertyGetter, 'makePropertyGetter');
            }
            {
              function makePropertySetter(f, t, p) {
                var override, x0___, x1___, x2___, x3___, x4___, x5___, x6___,
                x7___, x8___, x9___, x10___, x11___, x12___, x13___, x14___,
                x15___, x16___, x17___, x18___, x19___;
                override = (x0___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x3___ = f, x4___ = p, x2___ = (x1___
                    = schema.grantTypes_v___? schema.grantTypes:
                    schema.v___('grantTypes'), x1___.OVERRIDE_v___?
                    x1___.OVERRIDE: x1___.v___('OVERRIDE')), x0___.has_m___?
                  x0___.has(x3___, x4___, x2___): x0___.m___('has', [ x3___,
                      x4___, x2___ ])) || (x5___ = schema.grantAs_v___?
                  schema.grantAs: schema.v___('grantAs'), x8___ = f, x9___ = p,
                  x7___ = (x6___ = schema.grantTypes_v___? schema.grantTypes:
                    schema.v___('grantTypes'), x6___.METHOD_v___? x6___.METHOD:
                    x6___.v___('METHOD')), x5___.has_m___? x5___.has(x8___,
                    x9___, x7___): x5___.m___('has', [ x8___, x9___, x7___ ]))
                  && (x10___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x13___ = f, x14___ = p, x12___ =
                  (x11___ = schema.grantTypes_v___? schema.grantTypes:
                   schema.v___('grantTypes'), x11___.WRITE_v___? x11___.WRITE:
                   x11___.v___('WRITE')), x10___.has_m___? x10___.has(x13___,
                    x14___, x12___): x10___.m___('has', [ x13___, x14___,
                      x12___ ]));
                if (override) {
                  return makeStrictPrototypeMethod.i___(t, ___.f(function (v) {
                        var dis___ = this && this.___? void 0: this;
                        setFeralProperty.i___(untame.i___(dis___), p,
                          untame.i___(v));
                        return v;
                      }));
                } else if (x15___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x18___ = f, x19___ = p, x17___ =
                  (x16___ = schema.grantTypes_v___? schema.grantTypes:
                   schema.v___('grantTypes'), x16___.WRITE_v___? x16___.WRITE:
                   x16___.v___('WRITE')), x15___.has_m___? x15___.has(x18___,
                    x19___, x17___): x15___.m___('has', [ x18___, x19___,
                      x17___ ])) {
                  return makePrototypeMethod.i___(t, ___.f(function (v) {
                        var dis___ = this && this.___? void 0: this;
                        setFeralProperty.i___(untame.i___(dis___), p,
                          untame.i___(v));
                        return v;
                      }));
                } else {
                  return IMPORTS___.undefined_v___? IMPORTS___.undefined:
                  ___.ri(IMPORTS___, 'undefined');
                }
              }
              ___.f(makePropertySetter, 'makePropertySetter');
            }
            {
              function defineObjectProperty(f, t, p) {
                var get, set, x0___, x1___, x2___, x3___;
                get = makePropertyGetter.i___(f, t, p);
                set = makePropertySetter.i___(f, t, p);
                if (get || set) {
                  x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                  ___.ri(IMPORTS___, 'Object'), x2___ = t, x3___ = p, x1___ =
                    ___.iM([ 'enumerable', true, 'configurable', false, 'get',
                      get? get: errGet.i___(p), 'set', set? set: errSet.i___(p)
                    ]), x0___.defineProperty_m___? x0___.defineProperty(x2___,
                    x3___, x1___): x0___.m___('defineProperty', [ x2___, x3___,
                      x1___ ]);
                }
              }
              ___.f(defineObjectProperty, 'defineObjectProperty');
            }
            {
              function tameObjectWithMethods(f, t) {
                var x0___, x1___, x2___, x3___;
                if (!t) {
                  t = ___.iM([ ]);
                }
                x2___ = (x0___ = schema.grantAs_v___? schema.grantAs:
                  schema.v___('grantAs'), x1___ = f, x0___.getProps_m___?
                  x0___.getProps(x1___): x0___.m___('getProps', [ x1___ ])),
                x3___ = ___.f(function (p) {
                    if (isValidPropertyName.i___(p)) {
                      defineObjectProperty.i___(f, t, p);
                    }
                  }), x2___.forEach_m___? x2___.forEach(x3___):
                x2___.m___('forEach', [ x3___ ]);
                return t;
              }
              ___.f(tameObjectWithMethods, 'tameObjectWithMethods');
            }
            {
              function untame(t) {
                var ttype, x0___, x1___, f, ctor, x2___, x3___;
                if (t !== (IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object')).i___(t)) { return t; }
                ttype = typeof t;
                if (x0___ = IMPORTS___.Array_v___? IMPORTS___.Array:
                  ___.ri(IMPORTS___, 'Array'), x1___ = t, x0___.isArray_m___?
                  x0___.isArray(x1___): x0___.m___('isArray', [ x1___ ])) {
                  return untameArray.i___(t);
                }
                f = feralByTame.get_m___? feralByTame.get(t):
                feralByTame.m___('get', [ t ]);
                if (f) { return f; }
                if (tameByFeral.has_m___? tameByFeral.has(t):
                  tameByFeral.m___('has', [ t ])) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Feral object found on tame side of taming membrane: '
                      + t + '. The membrane has previously been compromised.'))
                    ;
                }
                if (! (privilegedAccess.isDefinedInCajaFrame_m___?
                      privilegedAccess.isDefinedInCajaFrame(t):
                    privilegedAccess.m___('isDefinedInCajaFrame', [ t ]))) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___('Host object leaked without being tamed');
                }
                if (ttype === 'object') {
                  ctor = privilegedAccess.directConstructor_m___?
                    privilegedAccess.directConstructor(t):
                  privilegedAccess.m___('directConstructor', [ t ]);
                  if (ctor === (privilegedAccess.BASE_OBJECT_CONSTRUCTOR_v___?
                        privilegedAccess.BASE_OBJECT_CONSTRUCTOR:
                      privilegedAccess.v___('BASE_OBJECT_CONSTRUCTOR'))) {
                    f = untameCajaRecord.i___(t);
                  } else {
                    f = copyBuiltin.i___(t);
                    if (f === void 0) {
                      throw new (IMPORTS___.TypeError_v___?
                        IMPORTS___.TypeError: ___.ri(IMPORTS___, 'TypeError'))
                        .new___(('Untaming of guest constructed objects unsupported: '
                          + t));
                    }
                  }
                } else if (ttype === 'function') {
                  f = (x2___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                    ___.ri(IMPORTS___, 'Object'), x3___ =
                    untameCajaFunction.i___(t), x2___.freeze_m___?
                    x2___.freeze(x3___): x2___.m___('freeze', [ x3___ ]));
                }
                if (f) {
                  tamesTo.i___(f, t);
                }
                return f;
              }
              ___.f(untame, 'untame');
            }
            {
              function untameCajaFunction(t) {
                return ___.f(function (_) {
                    {
                      ___.deodorize(arguments, -6);
                      var a___ = ___.args(arguments);
                    }
                    var dis___ = this && this.___? void 0: this;
                    return applyTameFunction.i___(t, tame.i___(dis___),
                      tameArray.i___(a___));
                  });
              }
              ___.f(untameCajaFunction, 'untameCajaFunction');
            }
            {
              function untameCajaRecord(t) {
                return (privilegedAccess.isES5Browser_v___?
                  privilegedAccess.isES5Browser:
                  privilegedAccess.v___('isES5Browser')) ?
                  untameCajaRecordByPropertyHandlers.i___(t):
                untameCajaRecordByEvisceration.i___(t);
              }
              ___.f(untameCajaRecord, 'untameCajaRecord');
            }
            {
              function untameCajaRecordByEvisceration(t) {
                var f;
                f = ___.iM([ ]);
                privilegedAccess.eviscerate_m___?
                  privilegedAccess.eviscerate(t, f, untame):
                privilegedAccess.m___('eviscerate', [ t, f, untame ]);
                tameRecord.i___(f, t);
                return f;
              }
              ___.f(untameCajaRecordByEvisceration,
                'untameCajaRecordByEvisceration');
            }
            {
              function untameCajaRecordByPropertyHandlers(t) {
                var f, x0___, x1___, x2___, x3___;
                f = ___.iM([ ]);
                x2___ = (x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                  ___.ri(IMPORTS___, 'Object'), x1___ = t,
                  x0___.getOwnPropertyNames_m___?
                  x0___.getOwnPropertyNames(x1___):
                  x0___.m___('getOwnPropertyNames', [ x1___ ])), x3___ =
                  ___.f(function (p) {
                    var d, x0___, x1___, x2___, read, write, get, set, x3___,
                    x4___, x5___, x6___;
                    if (isNumericName.i___(p)) { return; }
                    d = (x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                      ___.ri(IMPORTS___, 'Object'), x1___ = t, x2___ = p,
                      x0___.getOwnPropertyDescriptor_m___?
                      x0___.getOwnPropertyDescriptor(x1___, x2___):
                      x0___.m___('getOwnPropertyDescriptor', [ x1___, x2___ ]))
                      ;
                    read = (d.get_v___? d.get: d.v___('get')) ||
                      (d.hasOwnProperty_m___? d.hasOwnProperty('value'):
                      d.m___('hasOwnProperty', [ 'value' ]));
                    write = (d.set_v___? d.set: d.v___('set')) ||
                      (d.hasOwnProperty_m___? d.hasOwnProperty('value'):
                      d.m___('hasOwnProperty', [ 'value' ])) &&
                      (d.writable_v___? d.writable: d.v___('writable'));
                    get = !read? IMPORTS___.undefined_v___?
                      IMPORTS___.undefined: ___.ri(IMPORTS___, 'undefined'):
                    ___.f(function () {
                        return getTameProperty.i___(t, p);
                      });
                    set = !write? IMPORTS___.undefined_v___?
                      IMPORTS___.undefined: ___.ri(IMPORTS___, 'undefined'):
                    ___.f(function (v) {
                        setTameProperty.i___(t, p, tame.i___(v));
                        return v;
                      });
                    if (get || set) {
                      x3___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                      ___.ri(IMPORTS___, 'Object'), x5___ = f, x6___ = p, x4___
                        = ___.iM([ 'enumerable', true, 'configurable', false,
                          'get', get? get: errGet.i___(p), 'set', set? set:
                          errSet.i___(p) ]), x3___.defineProperty_m___?
                        x3___.defineProperty(x5___, x6___, x4___):
                      x3___.m___('defineProperty', [ x5___, x6___, x4___ ]);
                    }
                  }), x2___.forEach_m___? x2___.forEach(x3___):
                x2___.m___('forEach', [ x3___ ]);
                return preventExtensions.i___(f);
              }
              ___.f(untameCajaRecordByPropertyHandlers,
                'untameCajaRecordByPropertyHandlers');
            }
            {
              function hasTameTwin(f) {
                return tameByFeral.has_m___? tameByFeral.has(f):
                tameByFeral.m___('has', [ f ]);
              }
              ___.f(hasTameTwin, 'hasTameTwin');
            }
            {
              function hasFeralTwin(t) {
                return feralByTame.has_m___? feralByTame.has(t):
                feralByTame.m___('has', [ t ]);
              }
              ___.f(hasFeralTwin, 'hasFeralTwin');
            }
            feralByTame = new (IMPORTS___.WeakMap_v___? IMPORTS___.WeakMap:
              ___.ri(IMPORTS___, 'WeakMap')).new___;
            tameByFeral = new (IMPORTS___.WeakMap_v___? IMPORTS___.WeakMap:
              ___.ri(IMPORTS___, 'WeakMap')).new___;
            privilegedAccess.weakMapPermitHostObjects_m___?
              privilegedAccess.weakMapPermitHostObjects(tameByFeral):
            privilegedAccess.m___('weakMapPermitHostObjects', [ tameByFeral ]);
            x2___ = feralByTame, x0___ = privilegedAccess.USELESS_v___?
              privilegedAccess.USELESS: privilegedAccess.v___('USELESS'), x1___
              = privilegedAccess.USELESS_v___? privilegedAccess.USELESS:
            privilegedAccess.v___('USELESS'), x2___.set_m___? x2___.set(x0___,
              x1___): x2___.m___('set', [ x0___, x1___ ]);
            x5___ = tameByFeral, x3___ = privilegedAccess.USELESS_v___?
              privilegedAccess.USELESS: privilegedAccess.v___('USELESS'), x4___
              = privilegedAccess.USELESS_v___? privilegedAccess.USELESS:
            privilegedAccess.v___('USELESS'), x5___.set_m___? x5___.set(x3___,
              x4___): x5___.m___('set', [ x3___, x4___ ]);
            return x6___ = IMPORTS___.Object_v___? IMPORTS___.Object:
            ___.ri(IMPORTS___, 'Object'), x7___ = ___.iM([ 'tame', tame,
                'untame', untame, 'tamesTo', tamesTo, 'reTamesTo', reTamesTo,
                'hasTameTwin', hasTameTwin, 'hasFeralTwin', hasFeralTwin,
                'tameException', tameException, 'untameException',
                untameException ]), x6___.freeze_m___? x6___.freeze(x7___):
            x6___.m___('freeze', [ x7___ ]);
          }
          IMPORTS___.w___('TamingMembrane', ___.f(TamingMembrane,
              'TamingMembrane'));
        }
        moduleResult___ = ___.NO_RESULT;
        if (typeof IMPORTS___.v___('window') !== 'undefined') {
          moduleResult___ = (IMPORTS___.window_v___? IMPORTS___.window:
            ___.ri(IMPORTS___, 'window')).w___('TamingMembrane',
            IMPORTS___.TamingMembrane_v___? IMPORTS___.TamingMembrane:
            ___.ri(IMPORTS___, 'TamingMembrane'));
        }
        return moduleResult___;
},
'cajolerName': 'com.google.caja',
'cajolerVersion': '5470m',
'cajoledDate': 1372817922678
});
}