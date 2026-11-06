# Lite macro JSON -> MacroDroid ki ASAL export shakal (SetVariable createVar, poore variable objects).
# Wajah (6 Nov 2026): link se aaye macro ke chhote globalVariables phone par bane hi nahi ("Variable does not exist").
import copy

def fvar(name, typ, local=False, s="", i=0, b=False):
    return {"dictionary": {"entries": [], "isArray": False, "variableType": 4, "type": "Dictionary"},
            "isActionBlockWorkingVar": False, "isLocalVar": local, "m_booleanValue": b, "m_decimalValue": 0.0,
            "m_intValue": i, "m_name": name, "m_stringValue": s, "m_type": typ, "supportsInput": False, "supportsOutput": True}

SETV = {"disableLogging": False, "m_SIGUID": 0, "m_classType": "SetVariableAction", "m_constraintList": [], "m_isDisabled": False,
        "m_isOrCondition": False, "booleanDictionaryKeys": {"keys": []}, "createVar": True, "dictionaryKeys": [],
        "dictionaryOrArrayType": -1, "m_booleanInvert": False, "m_darkMode": -1, "m_doubleRandomMax": 0.0,
        "m_doubleRandomMin": 0.0, "m_falseLabel": "False", "m_intExpression": False, "m_intRandom": False,
        "m_intRandomMax": 0, "m_intRandomMin": 0, "m_intValueDecrement": False, "m_intValueIncrement": False,
        "m_newBooleanValue": False, "m_newDoubleValue": 0.0, "m_newIntValue": 0, "m_trueLabel": "True",
        "m_userPrompt": False, "m_userPromptEmptyAtStart": False, "m_userPromptPassword": False,
        "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": True}

def _v(o):
    return fvar(o["m_name"], o["m_type"], bool(o.get("isLocalVar")), o.get("m_stringValue", ""),
                o.get("m_intValue", 0), o.get("m_booleanValue", False))

def to_full(export):
    m = export["macro"]
    def walk(o):
        if isinstance(o, dict):
            if o.get("m_classType") == "SetVariableAction":
                f = copy.deepcopy(SETV); f.update(o); f["createVar"] = True; o.clear(); o.update(f)
            if isinstance(o.get("m_variable"), dict) and "m_name" in o["m_variable"]:
                o["m_variable"] = _v(o["m_variable"])
            for v in list(o.values()): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(m["m_actionList"]); walk(m.get("m_constraintList", []))
    if m.get("localVariables"): m["localVariables"] = [_v(dict(x, isLocalVar=True)) for x in m["localVariables"]]
    export["globalVariables"] = [_v(x) for x in export.get("globalVariables", [])]
    return export
