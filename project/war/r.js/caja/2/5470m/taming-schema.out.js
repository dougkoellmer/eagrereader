{
  ___.loadModule({
      'instantiate': function (___, IMPORTS___) {
        var dis___ = IMPORTS___;
        var moduleResult___;
        {
          function TamingSchema(privilegedAccess) {
            var PropertyFlags, grantTypes, x0___, x1___, grantAs, tameTypes,
            x2___, x3___, makeWeakMap, tameAs, tameFunctionName, tameCtorSuper,
            functionAdvice, applyFeralFunction, isNumericName, checkNonNumeric,
            fixed, checkCanControlTaming, fix, markTameAsReadOnlyRecord,
            markTameAsFunction, markTameAsCtor, markTameAsXo4a,
            grantTameAsMethod, grantTameAsRead, grantTameAsReadWrite,
            grantTameAsReadOverride, initAdvice, adviseFunctionBefore,
            adviseFunctionAfter, adviseFunctionAround, x4___, x5___, x6___,
            x7___, x8___, x9___;
            {
              function PropertyFlags() {
                var map, x0___, x1___;
                map = (IMPORTS___.WeakMap_v___? IMPORTS___.WeakMap:
                  ___.ri(IMPORTS___, 'WeakMap')).i___();
                return x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
                ___.ri(IMPORTS___, 'Object'), x1___ = ___.iM([ 'has', (function
                      () {
                        function has$_lit(obj, prop, flag) {
                          var x0___, x1___, x2___, x3___;
                          prop = '$' + prop;
                          return (map.has_m___? map.has(obj): map.m___('has', [
                                obj ])) && (x0___ = map.get_m___? map.get(obj):
                            map.m___('get', [ obj ]), x1___ = prop,
                            x0___.hasOwnProperty_m___?
                            x0___.hasOwnProperty(x1___):
                            x0___.m___('hasOwnProperty', [ x1___ ])) && (x2___
                            = (map.get_m___? map.get(obj): map.m___('get', [
                                  obj ])).v___(prop), x3___ = flag,
                            x2___.indexOf_m___? x2___.indexOf(x3___):
                            x2___.m___('indexOf', [ x3___ ])) !== -1;
                        }
                        return ___.f(has$_lit, 'has$_lit');
                      })(), 'set', (function () {
                        function set$_lit(obj, prop, flag) {
                          var x0___, x1___, x2___, o, x3___, x4___, x5___,
                          x6___;
                          prop = '$' + prop;
                          if (! (map.has_m___? map.has(obj): map.m___('has', [
                                  obj ]))) {
                            x1___ = map, x2___ = obj, x0___ = ___.iM([ ]),
                            x1___.set_m___? x1___.set(x2___, x0___):
                            x1___.m___('set', [ x2___, x0___ ]);
                          }
                          o = map.get_m___? map.get(obj): map.m___('get', [ obj
                            ]);
                          if (! (o.hasOwnProperty_m___? o.hasOwnProperty(prop):
                              o.m___('hasOwnProperty', [ prop ]))) {
                            o.w___(prop, [ ]);
                          }
                          if ((x3___ = o.v___(prop), x4___ = flag,
                              x3___.indexOf_m___? x3___.indexOf(x4___):
                              x3___.m___('indexOf', [ x4___ ])) === -1) {
                            x5___ = o.v___(prop), x6___ = flag,
                            x5___.push_m___? x5___.push(x6___):
                            x5___.m___('push', [ x6___ ]);
                          }
                        }
                        return ___.f(set$_lit, 'set$_lit');
                      })(), 'getProps', (function () {
                        function getProps$_lit(obj) {
                          var x0___, x1___, x2___, x3___;
                          if (! (map.has_m___? map.has(obj): map.m___('has', [
                                  obj ]))) { return [ ]; }
                          return x2___ = (x0___ = IMPORTS___.Object_v___?
                            IMPORTS___.Object: ___.ri(IMPORTS___, 'Object'),
                            x1___ = map.get_m___? map.get(obj): map.m___('get',
                              [ obj ]), x0___.getOwnPropertyNames_m___?
                            x0___.getOwnPropertyNames(x1___):
                            x0___.m___('getOwnPropertyNames', [ x1___ ])),
                          x3___ = ___.f(function (s) {
                              return s.substring_m___? s.substring(1):
                              s.m___('substring', [ 1 ]);
                            }), x2___.map_m___? x2___.map(x3___):
                          x2___.m___('map', [ x3___ ]);
                        }
                        return ___.f(getProps$_lit, 'getProps$_lit');
                      })() ]), x0___.freeze_m___? x0___.freeze(x1___):
                x0___.m___('freeze', [ x1___ ]);
              }
              ___.f(PropertyFlags, 'PropertyFlags');
            }
            {
              function makeWeakMap() {
                var map;
                map = new (IMPORTS___.WeakMap_v___? IMPORTS___.WeakMap:
                  ___.ri(IMPORTS___, 'WeakMap')).new___;
                privilegedAccess.weakMapPermitHostObjects_m___?
                  privilegedAccess.weakMapPermitHostObjects(map):
                privilegedAccess.m___('weakMapPermitHostObjects', [ map ]);
                return map;
              }
              ___.f(makeWeakMap, 'makeWeakMap');
            }
            {
              function applyFeralFunction(f, self, args) {
                return initAdvice.i___(f).i___(self, args);
              }
              ___.f(applyFeralFunction, 'applyFeralFunction');
            }
            {
              function isNumericName(n) {
                return typeof n === 'number' || '' + +n === n;
              }
              ___.f(isNumericName, 'isNumericName');
            }
            {
              function checkNonNumeric(prop) {
                if (isNumericName.i___(prop)) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Cannot control numeric property names: ' + prop))
                    ;
                }
              }
              ___.f(checkNonNumeric, 'checkNonNumeric');
            }
            {
              function checkCanControlTaming(f) {
                var to;
                to = typeof f;
                if (!f || to !== 'function' && to !== 'object') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Taming controls not for non-objects: ' + f));
                }
                if (fixed.has_m___? fixed.has(f): fixed.m___('has', [ f ])) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Taming controls not for already tamed: ' + f));
                }
                if (privilegedAccess.isDefinedInCajaFrame_m___?
                  privilegedAccess.isDefinedInCajaFrame(f):
                  privilegedAccess.m___('isDefinedInCajaFrame', [ f ])) {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError'))
                    .new___(('Taming controls not for Caja objects: ' + f));
                }
              }
              ___.f(checkCanControlTaming, 'checkCanControlTaming');
            }
            {
              function fix(f) {
                fixed.set_m___? fixed.set(f, true): fixed.m___('set', [ f, true
                  ]);
              }
              ___.f(fix, 'fix');
            }
            {
              function markTameAsReadOnlyRecord(f) {
                var x0___, x1___, x2___;
                checkCanControlTaming.i___(f);
                x1___ = tameAs, x2___ = f, x0___ =
                  tameTypes.READ_ONLY_RECORD_v___? tameTypes.READ_ONLY_RECORD:
                tameTypes.v___('READ_ONLY_RECORD'), x1___.set_m___?
                  x1___.set(x2___, x0___): x1___.m___('set', [ x2___, x0___ ]);
                return f;
              }
              ___.f(markTameAsReadOnlyRecord, 'markTameAsReadOnlyRecord');
            }
            {
              function markTameAsFunction(f, name) {
                var x0___, x1___, x2___;
                checkCanControlTaming.i___(f);
                x1___ = tameAs, x2___ = f, x0___ = tameTypes.FUNCTION_v___?
                  tameTypes.FUNCTION: tameTypes.v___('FUNCTION'),
                x1___.set_m___? x1___.set(x2___, x0___): x1___.m___('set', [
                    x2___, x0___ ]);
                tameFunctionName.set_m___? tameFunctionName.set(f, name):
                tameFunctionName.m___('set', [ f, name ]);
                return f;
              }
              ___.f(markTameAsFunction, 'markTameAsFunction');
            }
            {
              function markTameAsCtor(ctor, opt_super, name) {
                var ctype, stype, x0___, x1___, x2___;
                checkCanControlTaming.i___(ctor);
                ctype = typeof ctor;
                stype = typeof opt_super;
                if (ctype !== 'function') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError')).new___(('Cannot tame ' +
                      ctype + ' as ctor'));
                }
                if (opt_super && stype !== 'function') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError')).new___(('Cannot tame ' +
                      stype + ' as superclass ctor'));
                }
                x1___ = tameAs, x2___ = ctor, x0___ =
                  tameTypes.CONSTRUCTOR_v___? tameTypes.CONSTRUCTOR:
                tameTypes.v___('CONSTRUCTOR'), x1___.set_m___? x1___.set(x2___,
                  x0___): x1___.m___('set', [ x2___, x0___ ]);
                tameFunctionName.set_m___? tameFunctionName.set(ctor, name):
                tameFunctionName.m___('set', [ ctor, name ]);
                tameCtorSuper.set_m___? tameCtorSuper.set(ctor, opt_super):
                tameCtorSuper.m___('set', [ ctor, opt_super ]);
                return ctor;
              }
              ___.f(markTameAsCtor, 'markTameAsCtor');
            }
            {
              function markTameAsXo4a(f, name) {
                var ftype, x0___, x1___, x2___;
                checkCanControlTaming.i___(f);
                ftype = typeof f;
                if (ftype !== 'function') {
                  throw new (IMPORTS___.TypeError_v___? IMPORTS___.TypeError:
                    ___.ri(IMPORTS___, 'TypeError')).new___(('Cannot tame ' +
                      ftype + ' as function'));
                }
                x1___ = tameAs, x2___ = f, x0___ = tameTypes.XO4A_v___?
                  tameTypes.XO4A: tameTypes.v___('XO4A'), x1___.set_m___?
                  x1___.set(x2___, x0___): x1___.m___('set', [ x2___, x0___ ]);
                tameFunctionName.set_m___? tameFunctionName.set(f, name):
                tameFunctionName.m___('set', [ f, name ]);
                return f;
              }
              ___.f(markTameAsXo4a, 'markTameAsXo4a');
            }
            {
              function grantTameAsMethod(f, prop) {
                var x0___, x1___, x2___, x3___, x4___, x5___, x6___, x7___;
                checkCanControlTaming.i___(f);
                checkNonNumeric.i___(prop);
                x1___ = grantAs, x2___ = f, x3___ = prop, x0___ =
                  grantTypes.METHOD_v___? grantTypes.METHOD:
                grantTypes.v___('METHOD'), x1___.set_m___? x1___.set(x2___,
                  x3___, x0___): x1___.m___('set', [ x2___, x3___, x0___ ]);
                x5___ = grantAs, x6___ = f, x7___ = prop, x4___ =
                  grantTypes.READ_v___? grantTypes.READ:
                grantTypes.v___('READ'), x5___.set_m___? x5___.set(x6___,
                  x7___, x4___): x5___.m___('set', [ x6___, x7___, x4___ ]);
              }
              ___.f(grantTameAsMethod, 'grantTameAsMethod');
            }
            {
              function grantTameAsRead(f, prop) {
                var x0___, x1___, x2___, x3___;
                checkCanControlTaming.i___(f);
                checkNonNumeric.i___(prop);
                x1___ = grantAs, x2___ = f, x3___ = prop, x0___ =
                  grantTypes.READ_v___? grantTypes.READ:
                grantTypes.v___('READ'), x1___.set_m___? x1___.set(x2___,
                  x3___, x0___): x1___.m___('set', [ x2___, x3___, x0___ ]);
              }
              ___.f(grantTameAsRead, 'grantTameAsRead');
            }
            {
              function grantTameAsReadWrite(f, prop) {
                var x0___, x1___, x2___, x3___, x4___, x5___, x6___, x7___;
                checkCanControlTaming.i___(f);
                checkNonNumeric.i___(prop);
                x1___ = grantAs, x2___ = f, x3___ = prop, x0___ =
                  grantTypes.READ_v___? grantTypes.READ:
                grantTypes.v___('READ'), x1___.set_m___? x1___.set(x2___,
                  x3___, x0___): x1___.m___('set', [ x2___, x3___, x0___ ]);
                x5___ = grantAs, x6___ = f, x7___ = prop, x4___ =
                  grantTypes.WRITE_v___? grantTypes.WRITE:
                grantTypes.v___('WRITE'), x5___.set_m___? x5___.set(x6___,
                  x7___, x4___): x5___.m___('set', [ x6___, x7___, x4___ ]);
              }
              ___.f(grantTameAsReadWrite, 'grantTameAsReadWrite');
            }
            {
              function grantTameAsReadOverride(f, prop) {
                var x0___, x1___, x2___, x3___, x4___, x5___, x6___, x7___;
                checkCanControlTaming.i___(f);
                checkNonNumeric.i___(prop);
                x1___ = grantAs, x2___ = f, x3___ = prop, x0___ =
                  grantTypes.READ_v___? grantTypes.READ:
                grantTypes.v___('READ'), x1___.set_m___? x1___.set(x2___,
                  x3___, x0___): x1___.m___('set', [ x2___, x3___, x0___ ]);
                x5___ = grantAs, x6___ = f, x7___ = prop, x4___ =
                  grantTypes.OVERRIDE_v___? grantTypes.OVERRIDE:
                grantTypes.v___('OVERRIDE'), x5___.set_m___? x5___.set(x6___,
                  x7___, x4___): x5___.m___('set', [ x6___, x7___, x4___ ]);
              }
              ___.f(grantTameAsReadOverride, 'grantTameAsReadOverride');
            }
            {
              function initAdvice(f) {
                var x0___, x1___, x2___;
                if (! (functionAdvice.has_m___? functionAdvice.has(f):
                    functionAdvice.m___('has', [ f ]))) {
                  x1___ = functionAdvice, x2___ = f, x0___ = (function () {
                      function tamingNullAdvice(self, args) {
                        return privilegedAccess.applyFunction_m___?
                          privilegedAccess.applyFunction(f, self, args):
                        privilegedAccess.m___('applyFunction', [ f, self, args
                          ]);
                      }
                      return ___.f(tamingNullAdvice, 'tamingNullAdvice');
                    })(), x1___.set_m___? x1___.set(x2___, x0___):
                  x1___.m___('set', [ x2___, x0___ ]);
                }
                return functionAdvice.get_m___? functionAdvice.get(f):
                functionAdvice.m___('get', [ f ]);
              }
              ___.f(initAdvice, 'initAdvice');
            }
            {
              function adviseFunctionBefore(f, advice) {
                var p, x0___, x1___, x2___;
                p = initAdvice.i___(f);
                x1___ = functionAdvice, x2___ = f, x0___ = (function () {
                    function tamingBeforeAdvice(self, args) {
                      var x0___, x1___, x2___, x3___;
                      return p.i___(self, (x2___ = privilegedAccess, x3___ =
                          advice, x0___ = privilegedAccess.USELESS_v___?
                          privilegedAccess.USELESS:
                          privilegedAccess.v___('USELESS'), x1___ = [ f, self,
                            args ], x2___.applyFunction_m___?
                          x2___.applyFunction(x3___, x0___, x1___):
                          x2___.m___('applyFunction', [ x3___, x0___, x1___ ]))
                      );
                    }
                    return ___.f(tamingBeforeAdvice, 'tamingBeforeAdvice');
                  })(), x1___.set_m___? x1___.set(x2___, x0___):
                x1___.m___('set', [ x2___, x0___ ]);
              }
              ___.f(adviseFunctionBefore, 'adviseFunctionBefore');
            }
            {
              function adviseFunctionAfter(f, advice) {
                var p, x0___, x1___, x2___;
                p = initAdvice.i___(f);
                x1___ = functionAdvice, x2___ = f, x0___ = (function () {
                    function tamingAfterAdvice(self, args) {
                      var x0___, x1___, x2___, x3___;
                      return x2___ = privilegedAccess, x3___ = advice, x0___ =
                        privilegedAccess.USELESS_v___?
                        privilegedAccess.USELESS:
                      privilegedAccess.v___('USELESS'), x1___ = [ f, self,
                        p.i___(self, args) ], x2___.applyFunction_m___?
                        x2___.applyFunction(x3___, x0___, x1___):
                      x2___.m___('applyFunction', [ x3___, x0___, x1___ ]);
                    }
                    return ___.f(tamingAfterAdvice, 'tamingAfterAdvice');
                  })(), x1___.set_m___? x1___.set(x2___, x0___):
                x1___.m___('set', [ x2___, x0___ ]);
              }
              ___.f(adviseFunctionAfter, 'adviseFunctionAfter');
            }
            {
              function adviseFunctionAround(f, advice) {
                var p, x0___, x1___, x2___;
                p = initAdvice.i___(f);
                x1___ = functionAdvice, x2___ = f, x0___ = (function () {
                    function tamingAroundAdvice(self, args) {
                      var x0___, x1___, x2___, x3___;
                      return x2___ = privilegedAccess, x3___ = advice, x0___ =
                        privilegedAccess.USELESS_v___?
                        privilegedAccess.USELESS:
                      privilegedAccess.v___('USELESS'), x1___ = [ p, self, args
                      ], x2___.applyFunction_m___? x2___.applyFunction(x3___,
                        x0___, x1___): x2___.m___('applyFunction', [ x3___,
                          x0___, x1___ ]);
                    }
                    return ___.f(tamingAroundAdvice, 'tamingAroundAdvice');
                  })(), x1___.set_m___? x1___.set(x2___, x0___):
                x1___.m___('set', [ x2___, x0___ ]);
              }
              ___.f(adviseFunctionAround, 'adviseFunctionAround');
            }
            grantTypes = (x0___ = IMPORTS___.Object_v___? IMPORTS___.Object:
              ___.ri(IMPORTS___, 'Object'), x1___ = ___.iM([ 'METHOD',
                  'method', 'READ', 'read', 'WRITE', 'write', 'OVERRIDE',
                  'override' ]), x0___.freeze_m___? x0___.freeze(x1___):
              x0___.m___('freeze', [ x1___ ]));
            grantAs = PropertyFlags.i___();
            tameTypes = (x2___ = IMPORTS___.Object_v___? IMPORTS___.Object:
              ___.ri(IMPORTS___, 'Object'), x3___ = ___.iM([ 'CONSTRUCTOR',
                  'constructor', 'FUNCTION', 'function', 'XO4A', 'xo4a',
                  'READ_ONLY_RECORD', 'read_only_record' ]), x2___.freeze_m___?
              x2___.freeze(x3___): x2___.m___('freeze', [ x3___ ]));
            tameAs = makeWeakMap.i___();
            tameFunctionName = makeWeakMap.i___();
            tameCtorSuper = makeWeakMap.i___();
            functionAdvice = makeWeakMap.i___();
            fixed = makeWeakMap.i___();
            return x4___ = IMPORTS___.Object_v___? IMPORTS___.Object:
            ___.ri(IMPORTS___, 'Object'), x9___ = ___.iM([ 'published', (x5___
                  = IMPORTS___.Object_v___? IMPORTS___.Object:
                  ___.ri(IMPORTS___, 'Object'), x6___ = ___.iM([
                      'markTameAsReadOnlyRecord', markTameAsReadOnlyRecord,
                      'markTameAsFunction', markTameAsFunction,
                      'markTameAsCtor', markTameAsCtor, 'markTameAsXo4a',
                      markTameAsXo4a, 'grantTameAsMethod', grantTameAsMethod,
                      'grantTameAsRead', grantTameAsRead,
                      'grantTameAsReadWrite', grantTameAsReadWrite,
                      'grantTameAsReadOverride', grantTameAsReadOverride,
                      'adviseFunctionBefore', adviseFunctionBefore,
                      'adviseFunctionAfter', adviseFunctionAfter,
                      'adviseFunctionAround', adviseFunctionAround ]),
                  x5___.freeze_m___? x5___.freeze(x6___): x5___.m___('freeze',
                    [ x6___ ])), 'control', (x7___ = IMPORTS___.Object_v___?
                  IMPORTS___.Object: ___.ri(IMPORTS___, 'Object'), x8___ =
                  ___.iM([ 'grantTypes', grantTypes, 'grantAs', grantAs,
                      'tameTypes', tameTypes, 'tameAs', tameAs,
                      'tameFunctionName', tameFunctionName, 'tameCtorSuper',
                      tameCtorSuper, 'applyFeralFunction', applyFeralFunction,
                      'fix', fix ]), x7___.freeze_m___? x7___.freeze(x8___):
                  x7___.m___('freeze', [ x8___ ])) ]), x4___.freeze_m___?
              x4___.freeze(x9___): x4___.m___('freeze', [ x9___ ]);
          }
          IMPORTS___.w___('TamingSchema', ___.f(TamingSchema, 'TamingSchema'));
        }
        moduleResult___ = ___.NO_RESULT;
        if (typeof IMPORTS___.v___('window') !== 'undefined') {
          moduleResult___ = (IMPORTS___.window_v___? IMPORTS___.window:
            ___.ri(IMPORTS___, 'window')).w___('TamingSchema',
            IMPORTS___.TamingSchema_v___? IMPORTS___.TamingSchema:
            ___.ri(IMPORTS___, 'TamingSchema'));
        }
        return moduleResult___;
      },
      'cajolerName': 'com.google.caja',
      'cajolerVersion': '5470m',
      'cajoledDate': 1372817922954
});
}