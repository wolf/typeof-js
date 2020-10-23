; /* TypeOf(o), ...

Stand-alone.  Does not need jQuery (or anything else, for that matter).

Fixes some failures in the builtin typeof operator:

    TypeOf(null) => 'null'      typeof(null) => 'object'    Object.prototype.toString.call(null) => '[object Window]'
    TypeOf([]) => 'array'       typeof([]) => 'object'
    TypeOf(0/0) => 'NaN'        typeof(0/0) => 'number'

    Never uses instanceof, which fails across contexts.


Recognizes lists:

    TypeOf(arguments) => 'list'
    TypeOf(document.childNodes) => 'list'
    TypeOf(jQuery('span')) => 'list'
    TypeOf([]) => 'array'


Qualified calls, e.g., TypeOf.list(o), return a typename just as TypeOf(o) would, if o qualifies
(in this case, if o is a list) or else a result!=true.

    TypeOf.list("Hello, World") => 'string'
    TypeOf.list(7) => false
    TypeOf.list([]) => 'array'
    TypeOf.list(document.childNodes) => 'list'

    TypeOf.scalar("Hello, World!") => 'string'
    TypeOf.scalar([]) => false
    TypeOf.scalar(false) => 'boolean'
    TypeOf.scalar(0/0) => 'NaN'

    TypeOf.number("Hello, World!") => false
    TypeOf.number(Infinity) => 'Infinity'
    TypeOf.number(0/0) => 'NaN'
    TypeOf.number(1729) => 'number'

        TypeOf(o)==='number'        => exclude NaN (i.e., typeof(o)==='number' && !isNaN(o))
        TypeOf.number(o)==='number' => exclude NaN and +/- Infinity (i.e., typeof(o)==='number' && isFinite(o))
        TypeOf.number(o)            => include NaN, +/- Infinity (i.e., typeof(o)==='number')... but
            also includes the following:

    JavaScript is "flexible" with types.  Using == rather than ===, some
    examples and TypeOf.number's results:
        'number (boolean)'  true == 1
        'number (boolean)'  false == 0
        'number (null)'     null == 0
        'number (string)'   '' == 0
        'Infinity (string)' 'Infinity' == Infinity
        'number (string)'   '5' == 5
        'number (array)'    [] == 0
        'number (array)'    [7] == 7
    For any expression, x, that _can_ be interpreted as a number: x/1 gives you the number value.

    Let this be a lesson to you: === is _always_ preferable to ==.


Recognizes nodes:

    TypeOf(o) can return 'element', 'document', or 'node'
    TypeOf.element(o) will return the actual element kind, e.g., 'h1'
    TypeOf.node(o), similarly


Recognizes events:

    TypeOf(o) returns 'event'
    TypeOf.event(o) returns the actual event kind, e.g., 'click'

        You can write a function that can be used directly or as a click-handler:

        function close_widget( what ){
            switch ( TypeOf(what) ) {
                case 'event':   what=event.target;
                case 'element': what=$(what).closest('.widget');
                                what.hide();
            }
        }

    Uninitialized event objects return their event category if possible (e.g., 'MouseEvents')
    or else 'event'.

Recognizes some "almost builtin" types:

    'date', 'regexp', 'error', 'window'


Does not, itself, modify any system objects... but if you want to, you can hang a __typeOf function
(returning a string) almost anywhere you like.  TypeOf considers this an "intrusive" type.

*/


// The code below is entirely too clever.  It's old.  It works fine, but JavaScript has changed and some parts
// of this code are no longer needed.  Additionally, it works on broken browsers like old IE; and _that's_ no
// longer needed, either.

var TypeOf;
(function(){
var U=void(0), N=null, W=window, // short names for special globals (to save memory, believe it or not)
    ots=Object.prototype.toString, TRIMTK_RE=/^\[.+ |\]$/g,
    FN_TK='[object Function]', NAN_TK='[type NaN]', NUM_TK='[object Number]', OBJ_TK='[object Object]', // Type-keys I use more than once
    DOC_T='document', EL_T='element', EVT_T='event', FN_T='function', LIST_T='list', OBJ_T='object', WIN_T='window', // Type _names_ I use more than once
    KNOWN_TYPE={}, // maps type-key to type name
    LIST_TYPE={}, // "is this type list-like?"  Maps type-keys to either false (this type is not a list) or a string that is the specific list kind.
    NODE_TYPE=[], // maps node.nodeType (which is an integer index) to actual node kind which is "node" for everything except the document and the window
    SCALAR_TYPE={}, // maps type-key to type name, this dictionary is identical to KNOWN_TYPE and this probably indicates a bug
    CHECKED_TYPE={}, // the special types that typekey() has to dive deeper into
    FN_TYPE={}; // maps FN_TK to FN_T


// This section deals with type-keys, that is, the string returned by Object.prototype.toString; e.g., "[object Object]".
// All built in type-keys start with "[object ".  I add a few to disambiguate null, undefined, and NaN.
// To identify my changes, _my_ type-keys start with "[type ".  In modern JavaScript, however, this
// hole has been patched for null and undefined, so I could shorten this function safely.  In the following
// code, tk (any capitalization) means whatever it is is somehow related to a type-key.
// Throughout the code below, I use && and || to step through possibilities and return the final result from the step that
// succeeds.
function typekey( o ){
    var tk=ots.call(o);
    return tk in CHECKED_TYPE && (o===U && '[type undefined]' || o===N && '[type null]' || tk===NUM_TK && isNaN(o) && NAN_TK) || tk;
}
function distinct_typekey( o ){
    // returns the type-key, but refuses to return "[object Object]"; returns false instead for that.
    // This is because _so_ many things are "[object Object]" as far as JavaScript is concerned.
    var tk=typekey(o);
    return tk!==OBJ_TK && tk;
}
function trim( tk ){
    // Extracts and returns just the second word (the actual type name) in a type-key.
    return tk && tk.replace(TRIMTK_RE, '');
}


// The "maybe" functions below return a type name or else something falsey.
// The "qualify" functions return an extended description of the thing.

function qualify_number( o ){
    var tk=typekey(o), how;

    if ( tk===NUM_TK ) {
        how = '';
    } else if ( isNaN(o/=1) ) {
        return false;
    } else {
        how = ' (' + KNOWN_TYPE[ tk ] + ')';
    }

    return (isFinite(o) ? 'number' : o.toString()) + how;
}

function maybe_fn( o ){
    // This function gets replaced by something better from the initialization code for broken browsers.
    return false;
}
function qualify_fn( o ){
    // Take into account bad old browsers that called functions "[object Object]".
    // Ugh.  This function acts more like a "maybe" function than a "qualify".
    var qt=FN_TYPE[ typekey(o) ];
    return (qt===OBJ_T ? maybe_fn(o) : qt) || false;
}

function maybe_event( o ){
    return (typekey(o.cancelBubble)==='[object Boolean]' || qualify_fn(o.stopPropagation)) && EVT_T;
}

function maybe_list( o ){
    try { var n; return qualify_number(n=o.length)==='number' && (!n || n-1 in o) && LIST_T; } catch ( e ) {}
}

function maybe_node( o ){
    try { return o.nodeName && NODE_TYPE[ o.nodeType ]; } catch ( e ) {}
}
function qualify_node( o ){
    var t;
    return !!o && (
        (t=maybe_node(o))===DOC_T && t
            || t===EL_T && o.nodeName.toLowerCase()
            || t && o.nodeName
            || t
    );
}


// This is the core of the whole file.
TypeOf = function( o ){
    // return a string, the type of o
    var tk=typekey(o);
    return KNOWN_TYPE[ tk ]                         // is it a type we can deduce strictly from the type-key?
        || o===W && WIN_T                           // is it the global Window object?
        || qualify_fn(o.__typeOf) && o.__typeOf()   // does it have intrusive type information?
        || maybe_node(o)
        || maybe_event(o)
        || maybe_list(o)
        || tk===OBJ_TK && maybe_fn(o)               // some objects are actually functions
        || OBJ_T;                                   // I guess we just don't know
}


TypeOf.debug = KNOWN_TYPE;
TypeOf.element = function( o ){
    return !!o && maybe_node(o)===EL_T && qualify_node(o);
};
TypeOf.event = function( o ){
    var qt;
    if ( !o || !maybe_event(o) )
        return false;
    try { qt=o.type; } catch ( e ) { }
    return qt || trim(distinct_typekey(o)) || EVT_T;
};
TypeOf.fn = qualify_fn;
TypeOf.list = function( o ){
    var tk=typekey(o);
    return tk in LIST_TYPE ? LIST_TYPE[ tk ] : !!o && maybe_list(o);
};
TypeOf.node = qualify_node;
TypeOf.number = qualify_number;
TypeOf.object = function( o ){
    // returns the type name as rendered by Object.prototype.toString
    return trim(typekey(o).replace(NAN_TK, NUM_TK));
};
TypeOf.scalar = function( o ){
    return SCALAR_TYPE[ typekey(o) ] || false;
};


(function(){
    // This is the initialization function.  It does its job and then goes away.
    // It would probably be better to name, run, and finally delete this function.
    var EL_NT=1, DOC_NT=9, LAST_NT=12;

    FN_TYPE[ FN_TK ] = 'function';

    CHECKED_TYPE[ ots.call(U) ] = true;
    CHECKED_TYPE[ ots.call(N) ] = true;
    CHECKED_TYPE[ NUM_TK ] = false;

    for ( var i=EL_NT; i<=LAST_NT; ++i ) {
        NODE_TYPE[ i ] = 'node';
    }
    NODE_TYPE[ EL_NT ] = EL_T;
    NODE_TYPE[ DOC_NT ] = DOC_T;

    function define( o, scalar, list, tn ){
        var tk=distinct_typekey(o);
        if ( tk ) {
            tn || (tn = trim(tk).toLowerCase());

            KNOWN_TYPE[ tk ] = tn;
            scalar!==U  && (SCALAR_TYPE[ tk ] = tn);
            list!==U    && (LIST_TYPE[ tk ] = list && tn);
        }
        return tk;
    }

    define(void(0),         true, false);
    define(null,            true, false);
    define(false,           true, false);
    define(0,               true, false);
    define(0/0,             true, false, 'NaN');
    define('',              true, true);

    define(function(){},    false, false);
    define([],              false, true);
    define(/./,             false, false);
    define(new Date(),      false, false);
    define(new Error(),     false, false);

    define(document,        false, false, DOC_T);
    if ( !define(window,    false, false, WIN_T) ) {
        TypeOf.list = function( o ){
            var tk;
            return o!==window && ((tk=typekey(o)) in LIST_TYPE ? LIST_TYPE[ tk ] : !!o && maybe_list(o));
        };
    }

    define(document.childNodes, false, true, LIST_T);
    define(arguments,       false, true, LIST_T);

    if ( document.createEvent ) {
        define(document.createEvent('UIEvents'),        false, false, EVT_T);
        define(document.createEvent('MouseEvents'),     false, false, EVT_T);
        define(document.createEvent('MutationEvents'),  false, false, EVT_T);
        define(document.createEvent('HTMLEvents'),      false, false, EVT_T);
    }

    // This is the bit for broken browsers that don't tell you when o is a function.
    if ( !qualify_fn(document.getElementById) ) {
        FN_TYPE[ OBJ_TK ] = OBJ_T;
        maybe_fn = function( o ){
            return FN_TYPE[ typekey(o.call) ]
                && FN_TYPE[ typekey(o.apply) ]
                && FN_T;
        };
    }
})();

})();

