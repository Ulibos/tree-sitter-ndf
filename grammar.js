// Lower Case To Case Insensitive
// "test" => /[tT][eE][sS][tT]/
function lc2ci(word) {
    return new RegExp(word
                .split('')
                .map(c=>`[${c}${c.toUpperCase()}]`)
                .join(''));
}

function lc2map(words) {
    return Object.fromEntries(new Map(words.map(word => [word, lc2ci(word)])));
}

const keywords_lower = [
    'export','unnamed','private','public','template',
    'is','nil','div','guid','true','false'
]

const builtin_types_lower = [
    'bool','string','tguid','int','float',
]

const builtin_vector_types_lower = [
    'int2','int3','int4',
    'float2','float3','float4',
    'rgba','vector','ifte','pair','map'
]

const KEYWORDS = lc2map(keywords_lower);

const BUILTIN_TYPES = lc2map(builtin_types_lower);

const BUILTIN_VECTOR_TYPES = lc2map(builtin_vector_types_lower);

const PREC = {
    map: 12,
    template: 12,
    object: 10,
    keyword : 10,
    multiplicative : 10,
    additive : 9,
    unary : 7,
    binary : 6,
    generic: 5,
    comparative : 4,
    and : 3,
    or: 2,
    ternary: 1,
    ref: -1,
}


module.exports = grammar({
  name: 'ndf',
  
  extras: $ => [
    /\s+/,
    $.comment_block_classic,
    $.comment_block_round,
    $.comment_block_curly,  
    $.comment_inline,
  ],
  
  externals: $ => [
    $._comment_block_classic_content,
    $._comment_block_round_content,
    $._curly_brackets_content,
    $._string_double_content,
    $._string_single_content,
    $._error_sentinel,
  ],

  conflicts: $ => [
    [$._ref_init, $.name],
    [$._ref_indexed_init, $.name],
  ],

  word: $ => $._word_identifier,

  supertypes: $ => [
    $._expression,
    $._ref,
    $._number
  ],

  rules: {
    source_file: $ => repeat(choice(
        $.assignment,
        $.template,
        $.unnamed,
        $.visibility,
        $._expression,
        $.member, // allows to parse a simple test expression
    )),


    _expression: $ => prec(1, choice(
        $.object,
        $.pair,
        $.group,
        $.list,
        $.map,
        $.unary_expression,
        $.binary_expression,
        $.generic,
        $.guid,
        $.string,
        $.ternary,
        $.vector_type,
        $.visibility,
        $.assignment,
        $._number,
        $._reference,
    )),
    
    // ================== top level
    assignment: $ => seq(
        field('name', $.name),
        alias(KEYWORDS.is, $.keyword),
        field('value', $._expression),
    ),
    
    visibility: $ => seq(
        field('type', alias(choice(
            KEYWORDS.export,
            KEYWORDS.private,
            KEYWORDS.public,
        ), $.keyword)),
        field('item', choice(
            $.assignment,
            $.template,
        )),
    ),
    
    object: $ => prec.left(PREC.object, seq(
        field('type', alias($.name, $.type)),
        choice('(', token.immediate('(')),
        field('members', optional($.members)),
        ')',
    )),

    template: $ => seq(
        alias(KEYWORDS.template, $.keyword),
        field('name', $.name),
        choice('[', token.immediate('[')),
        field('params', optional($.params)),
        ']',
        alias(KEYWORDS.is, $.keyword),
        field('value', $.object), // named for consistency with $.object
    ),

    unnamed: $ => seq(
        alias(KEYWORDS.unnamed, $.keyword),
        field('object', $.object)
    ),

    params: $ => repeat1(choice(
        alias($.member, $.param),
        alias($._param_name, $.param),
        ','
    )),
    _param_name: $ => field('name', $.name), // mimics member structure for consistency
    
    members: $ => repeat1(
        choice(
            $._ref_init,
            $.member,
            $.assignment,
            $.visibility,
    )),

    member: $=> seq(
        field('name', $.name),
        choice(
            seq(':',
                field('type', $.type)),
            seq('=',
                field('value', $._expression)),
            seq(':',
                field('type', $.type),
                '=',
                field('value', $._expression)),
            // || fix for strange case, most likely a typo in sources
            // vv GameData\UserInterface\Use\InGame\UISpecificShortcutsForSelectionView.ndf:13
            seq(':',
                '=',
                field('value', $._expression)),
        ),
    ),
    
    // ================== structures
    
    // map: TODO: Maybe better of allowing any type of expression, not just pairs, and leaving
    // formatting analysis to linters?
    map: $ => prec(PREC.map, seq( 
        alias(BUILTIN_VECTOR_TYPES.map, $.keyword),
        choice('[', token.immediate('[')), // choice prevents conflicts with vector and indexed
        field('pairs', optional($.pairs)),
        ']',
    )),

    list: $ => seq(
        '[',
        field('items', optional(alias($._exprSeq, $.items))),
        ']',
    ),
    
    pairs: $ => seq(
        $.pair,
        repeat(seq(',', $.pair)),
        optional(',')
    ),

    pair: $ => seq(
        '(',
        field('left', $._expression),
        ',',
        field('right', $._expression),
        ')'
    ),

    
    // ================== basic
    // || support for multiple commas because of
    // vv GameData\Gameplay\Skirmish\Strategies\GenericSkirmishStrategy.ndf:101
    _exprSeq: $ => choice(
        $._expression,
        seq(
            repeat(','),
            repeat1(seq($._expression,repeat1(','))),
            optional($._expression)),
        repeat1(',')
    ),

    unary_expression: $ => prec(PREC.unary, seq(
        field('operator', alias(choice('-', '!'), $.operator)),
        field('right', $._expression),
    )),
    
    ternary: $ => prec.right(PREC.ternary, seq(
        field('cond', $._expression),
        '?',
        field('true', $._expression),
        ':',
        field('false', $._expression),
    )),

    binary_expression: $ => {
      const table = [
        [PREC.and, '&'],
        [PREC.or, '|'],
        [PREC.comparative, choice('==', '!=', '<', '<=', '>', '>=')],
        [PREC.additive, choice('+', '-')],
        [PREC.multiplicative, choice('*', KEYWORDS.div, '%')],
      ];

      return choice(...table.map(([precedence, operator]) => {
        let op = operator == KEYWORDS.div ? alias(operator, $.keyword) : alias(operator, $.operator);
        return prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', op),
        field('right', $._expression),
      ))}
    ));
    },
    
    _number: $ => choice(
        $.nil,
        $.number_dec,
        $.number_hex,
        $.number_float,
    ),

    nil: $ => prec(PREC.keyword, KEYWORDS.nil),
    number_dec: $ => /[0-9]+/,
    number_hex: $ => /0[xX][0-9a-fA-F]+/,
    number_float: $ => choice(
        /\.[0-9]+/,
        /[0-9]+\.[0-9]*/
    ),
    
    vector_type: $ => seq(
        field('type', choice(
            $.builtin_vector_type,
            $.name,)),
        // || choice prevents error in conflicts with _ref_indexed_init
        // vv 
        choice('[', token.immediate('[')),
        field('items', optional(alias($._exprSeq, $.items))),
        ']'
    ),

    guid: $ => seq(
        alias(KEYWORDS.guid, $.keyword),
        ':',
        '{',
        field('guid', alias($._curly_brackets_content, $.number_hex)),
        '}'
    ),
    
    comment_inline: $ => token(seq('//', /[^\n\r]*/)),
    comment_block_classic: $ => seq('/*', $._comment_block_classic_content, '*/'),
    comment_block_round: $ => seq('(*', $._comment_block_round_content, '*)'),
    comment_block_curly: $ => seq('{', $._curly_brackets_content, '}'),
    

    group: $ => prec(-10, seq('(', field('item', optional($._expression)), ')')),
    
    string: $ => choice($._string_double, $._string_single),
    _string_double: $ => seq('\"', $._string_double_content, '\"'),
    _string_single: $ => seq('\'', $._string_single_content, '\''),


    type: $ => prec.right(seq(
        $._type_name,
        optional($._type_parameters),
    )),
    _type_name: $ => choice(
        $.builtin_type,
        $.builtin_vector_type,
        $.name,
    ),

    _type_parameters: $ => seq(
        token.immediate('<'),
        repeat1(seq(
            $.type,
            optional(','))),
        '>',
    ),

    generic: $ => prec.left(PREC.generic,
        seq('<',
            alias(token.immediate(choice(
                /[a-zA-Z_][a-zA-Z0-9_]+/,
                /[a-zA-Z]/,
            )), $.name),
            token.immediate('>'),
            optional($.generic_indexed)
        )
    ),
    generic_indexed: $ => seq(token.immediate('['),$._expression,']'),

    // ------------------------
    // references related stuff
    // ------------------------
    _reference: $ => prec(PREC.ref, choice(
            alias($._ref_scoped, $.ref_nested),
            $._ref_init,
    )),

    _ref: $ => choice(
        $.ref_terminal,
        $.ref_nested,
        $.ref_nested_unnamed,
        $.ref_indexed,
        $.ref_member,
    ),

    // prec PREC.ref is needed to avoid mistaking (object) for (ref_terminal)(group)
    // in rare specific cases
    _ref_init: $ => prec.right(choice(
        prec(PREC.ref, alias($._word_identifier, $.ref_terminal)),
        alias($._ref_nested_init, $.ref_nested),
        alias($._ref_indexed_init, $.ref_indexed),
        alias($._ref_member_init, $.ref_member),
    )),


    _ref_scoped: $ => prec.right(seq(
        alias(/[\.\~\$]/, $.ref_scope),
        token.immediate('/'),
        $._ref
    )),

    // nested
    ref_nested: $ => prec.right(seq(
        $._ref,
        token.immediate('/'),
        $._ref)),
    _ref_nested_init: $ => prec.right(seq(
        alias($._word_identifier, $.ref_terminal),
        token.immediate('/'),
        $._ref)),
    

    ref_nested_unnamed: $ => prec.right(seq(
        token.immediate('/'),
        $._ref)),

    // member
    ref_member: $ => prec.right(seq(
        $._ref,
        token.immediate('.'),
        $._ref)),
    _ref_member_init: $ => prec.right(seq(
        alias($._word_identifier, $.ref_terminal),
        token.immediate('.'),
        $._ref)),

    // indexed
    ref_indexed: $ => prec.right(seq(
        $._ref,
        token.immediate('['),
        $._expression,
        ']')),
    _ref_indexed_init: $ => prec.right(seq(
        alias($._word_identifier, $.ref_terminal),
        token.immediate('['),
        $._expression,
        ']')),

    ref_terminal: $ => prec(PREC.ref, token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/)),
    
    // -------------------------
    // word related basic tokens
    // -------------------------
    builtin_vector_type: $ => choice(...Object.values(BUILTIN_VECTOR_TYPES)),

    builtin_type: $ => choice(...Object.values(BUILTIN_TYPES)), // TODO: integrate
    
    keyword: $ => choice(...Object.values(KEYWORDS)),

    name: $ => $._word_identifier,

    _word_identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
  }
});
