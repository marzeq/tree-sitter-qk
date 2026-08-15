const PREC = {
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  BITWISE_OR: 3,
  BITWISE_XOR: 4,
  BITWISE_AND: 5,
  COMPARISON: 6,
  SHIFT: 7,
  ADD: 8,
  MULTIPLY: 9,
  UNARY: 10,
  POSTFIX: 11,
};

module.exports = grammar({
  name: 'qk',

  word: $ => $.identifier,

  extras: $ => [
    /[\s\uFEFF\u2060\u200B]/,
    /\\\r?\n/,
    $.line_comment,
    $.block_comment,
  ],

  supertypes: $ => [
    $.expression,
    $.statement,
    $.type,
  ],

  conflicts: $ => [
    [$.binding_declaration, $.type_identifier],
    [$.function_name, $.type_identifier],
    [$.expression, $.type_identifier],
    [$.import_spec],
    [$.for_each_clause, $.expression],
    [$.for_each_clause, $.expression, $.type_identifier],
    [$.for_each_destructure, $.expression],
    [$.for_statement, $.expression],
    [$.sequence_literal, $.slice_type],
    [$.sequence_literal, $.array_type],
    [$.statement, $.when_expression_block],
    [$.expression_statement, $.when_expression_block],
    [$.named_type],
    [$.when_expression_block, $.when_type_block],
    [$.expression, $.struct_literal],
  ],

  rules: {
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.module_declaration,
      $.import_declaration,
      $.function_definition,
      $.type_definition,
      $.binding_declaration,
      $.multi_binding_declaration,
      $.compile_time_when,
      $.compiler_error_directive,
      $.compiler_assert_directive,
      $.attribute,
      ';',
    ),

    module_declaration: $ => prec.right(seq(
      'module',
      field('name', $.module_path),
      repeat(field('attribute', $.attribute)),
    )),

    import_declaration: $ => seq(
      'import',
      choice(
        $.import_spec,
        seq('(', repeat(seq($.import_spec, optional(','))), ')'),
      ),
    ),

    import_spec: $ => seq(
      field('path', $.module_path),
      optional(field('alias', $.identifier)),
    ),

    module_path: $ => prec.left(seq(
      $.identifier,
      repeat(seq('.', $.identifier)),
    )),

    function_definition: $ => prec.right(seq(
      optional('pub'),
      'let',
      field('name', $.function_name),
      field('parameters', $.parameter_list),
      optional(seq(':', field('return_type', $.return_type))),
      repeat(field('attribute', $.attribute)),
      optional(field('body', choice(
        $.block,
        seq('=', $.expression),
      ))),
    )),

    function_name: $ => choice(
      field('function', $.identifier),
      seq(
        field('owner', choice(
          $.identifier,
          seq('(', $.type, ')'),
        )),
        '.',
        field('method', $.identifier),
      ),
    ),

    parameter_list: $ => seq(
      '(',
      optional(seq(
        commaSep1(choice(
          $.receiver_parameter,
          $.type_parameter,
          $.parameter,
          $.variadic_parameter,
        )),
        optional(','),
      )),
      ')',
    ),

    receiver_parameter: $ => choice(
      alias('self', $.identifier),
      seq('*', optional('mut'), alias('self', $.identifier)),
    ),

    type_parameter: $ => seq(
      '$',
      field('name', $.type_identifier),
      ':',
      'type',
      optional(seq('(', field('constraint', $.type), ')')),
    ),

    type_parameter_list: $ => seq(
      '(',
      commaSep1($.type_parameter),
      optional(','),
      ')',
    ),

    parameter: $ => seq(
      commaSep1($.parameter_name),
      ':',
      optional('...'),
      field('type', $.type),
      optional(seq('=', field('default', $.expression))),
    ),

    parameter_name: $ => seq(
      optional('mut'),
      field('name', $.identifier),
      optional(seq('=', field('default', $.expression))),
    ),

    variadic_parameter: _ => '...',

    return_type: $ => choice(
      $.type,
      seq('(', commaSep1($.type), ')'),
    ),

    type_definition: $ => seq(
      optional('pub'),
      'let',
      field('name', $.type_identifier),
      optional(field('type_parameters', $.type_parameter_list)),
      '=',
      'type',
      optional('alias'),
      field('value', $.type),
    ),

    binding_declaration: $ => prec.right(seq(
      optional('pub'),
      'let',
      optional('mut'),
      optional(field('compile_time', '$')),
      field('name', $.identifier),
      optional(seq(':', field('type', $.type))),
      choice(
        seq(
          '=',
          field('value', $.expression),
          repeat(field('attribute', $.attribute)),
        ),
        repeat1(field('attribute', $.attribute)),
      ),
    )),

    multi_binding_declaration: $ => seq(
      'let',
      optional('mut'),
      field('name', $.identifier),
      ',',
      commaSep1(field('name', $.identifier)),
      '=',
      field('value', $.expression),
    ),

    block: $ => seq('{', repeat(seq($.statement, optional(';'))), '}'),

    statement: $ => choice(
      $.function_definition,
      $.type_definition,
      $.binding_declaration,
      $.multi_binding_declaration,
      $.assignment_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.defer_statement,
      $.for_statement,
      $.compile_time_when,
      $.compiler_error_directive,
      $.compiler_assert_directive,
      $.attribute,
      $.expression_statement,
    ),

    assignment_statement: $ => seq(
      commaSep1(field('left', $.expression)),
      field('operator', choice(
        '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
      )),
      field('right', $.expression),
    ),

    return_statement: $ => prec.right(seq('return', optional(commaSep1($.expression)))),
    break_statement: _ => 'break',
    continue_statement: _ => 'continue',
    defer_statement: $ => seq('defer', $.expression),
    expression_statement: $ => $.expression,

    if_expression: $ => prec.right(seq(
      'if',
      field('condition', $.expression),
      field('consequence', $.block),
      repeat(seq('else', 'if', field('condition', $.expression), field('consequence', $.block))),
      optional(seq('else', field('alternative', $.block))),
    )),

    match_expression: $ => seq(
      'match',
      field('subject', $.expression),
      repeat(seq(',', field('subject', $.expression))),
      optional(seq('as', field('binding', $.identifier))),
      '{',
      repeat(choice(
        alias($._block_match_arm, $.match_arm),
        seq($.match_arm, ','),
      )),
      optional($.match_arm),
      '}',
    ),

    _block_match_arm: $ => prec(1, seq(
      field('pattern', $.match_pattern),
      repeat(seq(',', field('pattern', $.match_pattern))),
      optional(seq('if', field('guard', $.expression))),
      '=>',
      field('body', $.block),
      optional(','),
    )),

    match_arm: $ => seq(
      field('pattern', $.match_pattern),
      repeat(seq(',', field('pattern', $.match_pattern))),
      optional(seq('if', field('guard', $.expression))),
      '=>',
      field('body', $.expression),
    ),

    match_pattern: $ => prec.left(seq(
      $.match_pattern_term,
      repeat(seq('|', $.match_pattern_term)),
    )),

    match_pattern_term: $ => choice(
      $.match_pattern_atom,
      seq(field('start', $.literal), '..', field('end', $.literal)),
    ),

    match_pattern_atom: $ => choice(
      alias('_', $.wildcard),
      $.literal,
      $.variant_pattern,
    ),

    variant_pattern: $ => seq(
      '.',
      field('variant', $.identifier),
      optional(seq('(', optional(seq(commaSep1($.pattern_binding), optional(','))), ')')),
    ),

    pattern_binding: $ => seq(
      optional(seq(field('field', $.identifier), '=')),
      field('name', $.identifier),
    ),

    for_statement: $ => seq(
      'for',
      optional(choice($.for_each_clause, $.for_clause, $.expression)),
      field('body', $.block),
    ),

    for_each_clause: $ => seq(
      choice(
        seq(
          field('element', $.identifier),
          optional(seq('.', '&', optional('mut'))),
        ),
        field('element', $.for_each_destructure),
      ),
      optional(seq(',', field('index', $.identifier))),
      'in',
      field('iterable', $.expression),
      optional(seq('..', optional('='), field('end', $.expression))),
      repeat($.iteration_attribute),
    ),

    for_each_destructure: $ => seq(
      '(',
      commaSep1(field('binding', choice(alias('_', $.wildcard), $.identifier))),
      ')',
    ),

    for_clause: $ => prec.left(seq(
      optional(choice($.binding_declaration, $.assignment_statement, $.expression)),
      ';',
      optional($.expression),
      ';',
      optional(choice($.assignment_statement, $.expression)),
    )),

    iteration_attribute: $ => seq('@', alias('reversed', $.attribute_name)),

    compile_time_when: $ => prec.right(seq(
      'when',
      field('condition', $.expression),
      field('consequence', $.compile_time_block),
      repeat(seq('else', 'when', field('condition', $.expression), field('consequence', $.compile_time_block))),
      optional(seq('else', field('alternative', $.compile_time_block))),
    )),

    compile_time_block: $ => seq(
      '{',
      repeat(choice($.module_declaration, $.import_declaration, $.statement, ';')),
      '}',
    ),

    compiler_error_directive: $ => seq(
      '@', alias('compiler_error', $.builtin_name), '(', $.string_literal, ')',
    ),

    compiler_assert_directive: $ => seq(
      '@', alias('compiler_assert', $.builtin_name),
      '(', field('condition', $.expression), ',', field('message', $.string_literal), ')',
    ),

    attribute: $ => choice($.link_attribute, $.ordinary_attribute),

    ordinary_attribute: $ => prec.right(seq(
      '@',
      field('name', $.attribute_name),
      optional(seq('(', optional(seq(commaSep1($.attribute_argument), optional(','))), ')')),
    )),

    attribute_argument: $ => choice(
      $.string_literal,
      seq(field('name', $.identifier), field('value', $.string_literal)),
    ),

    link_attribute: $ => seq(
      '@', alias('link', $.attribute_name),
      '(', repeat(seq($.link_item, optional(','))), ')',
    ),

    link_item: $ => choice(
      $.link_entry,
      $.link_when,
      $.compiler_error_directive,
    ),

    link_entry: $ => seq(
      field('kind', alias(choice('system', 'path', 'search', 'framework'), $.link_kind)),
      field('value', $.string_literal),
    ),

    link_when: $ => prec.right(seq(
      'when', field('condition', $.expression), field('consequence', $.link_block),
      repeat(seq('else', 'when', field('condition', $.expression), field('consequence', $.link_block))),
      optional(seq('else', field('alternative', $.link_block))),
    )),

    link_block: $ => seq('{', repeat(seq($.link_item, optional(','))), '}'),

    expression: $ => choice(
      $.identifier,
      $.literal,
      $.no_initializer,
      $.parenthesized_expression,
      $.block,
      $.if_expression,
      $.match_expression,
      $.when_expression,
      $.lambda_expression,
      $.struct_literal,
      $.sequence_literal,
      $.builtin_expression,
      $.inline_assembly_expression,
      $.unary_expression,
      $.binary_expression,
      $.call_expression,
      $.field_expression,
      $.index_expression,
      $.slice_expression,
      $.reference_expression,
      $.dereference_expression,
      $.cast_expression,
      $.enum_literal,
    ),

    parenthesized_expression: $ => seq('(', $.expression, ')'),

    lambda_expression: $ => prec.right(seq(
      field('parameters', $.lambda_parameter_list),
      '=>',
      field('body', $.expression),
    )),

    lambda_parameter_list: $ => seq(
      '|',
      optional(seq(commaSep1($.lambda_parameter), optional(','))),
      '|',
    ),

    lambda_parameter: $ => prec.right(seq(
      commaSep1($.lambda_parameter_name),
      optional(seq(':', optional('...'), field('type', $.type))),
    )),

    lambda_parameter_name: $ => field('name', $.identifier),

    unary_expression: $ => prec.right(PREC.UNARY, seq(
      field('operator', choice('!', '-', '~')),
      field('operand', $.expression),
    )),

    binary_expression: $ => choice(
      binary($, PREC.LOGICAL_OR, '||'),
      binary($, PREC.LOGICAL_AND, '&&'),
      binary($, PREC.BITWISE_OR, '|'),
      binary($, PREC.BITWISE_XOR, '^'),
      binary($, PREC.BITWISE_AND, '&'),
      binary($, PREC.COMPARISON, choice('==', '!=', '<', '>', '<=', '>=')),
      binary($, PREC.SHIFT, choice(seq('<', '<'), seq('>', '>'))),
      binary($, PREC.ADD, choice('+', '-')),
      binary($, PREC.MULTIPLY, choice('*', '/', '%')),
    ),

    call_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('function', $.expression),
      field('arguments', $.argument_list),
    )),

    argument_list: $ => seq(
      '(',
      optional(seq(commaSep1($.expression), optional('...'), optional(','))),
      ')',
    ),

    field_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression), '.', field('field', $.identifier),
    )),

    index_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression), '[', field('index', $.expression), ']',
    )),

    slice_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression),
      '[',
      optional(field('start', $.expression)),
      ':',
      optional(field('end', $.expression)),
      ']',
    )),

    reference_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression), '.', '&', optional('mut'),
    )),

    dereference_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression), '.', '*',
    )),

    cast_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', $.expression), '.', '(', field('type', $.type), ')',
    )),

    enum_literal: $ => seq('.', field('variant', $.identifier)),

    when_expression: $ => prec.right(seq(
      'when', field('condition', $.expression), field('consequence', $.when_expression_block),
      repeat(seq('else', 'when', field('condition', $.expression), field('consequence', $.when_expression_block))),
      optional(seq('else', field('alternative', $.when_expression_block))),
    )),

    when_expression_block: $ => seq('{', field('value', choice($.expression, $.compiler_error_directive)), '}'),

    struct_literal: $ => prec.dynamic(5, seq(
      choice(
        seq('.', '{'),
        seq(field('type', choice($.named_type, $.field_expression, $.call_expression)), '.', '{'),
      ),
      optional(choice(
        seq(commaSep1($.field_initializer), optional(',')),
        seq(commaSep1($.flag_initializer), optional(',')),
      )),
      '}',
    )),

    field_initializer: $ => choice(
      seq(field('field', $.identifier), '=', field('value', $.expression)),
      $.no_initializer,
    ),

    flag_initializer: $ => seq('.', field('member', $.identifier)),

    sequence_literal: $ => seq(
      '[',
      optional(choice(
        seq(commaSep1($.expression), optional(',')),
        seq(field('value', $.expression), ';', field('count', $.expression)),
      )),
      ']',
    ),

    builtin_expression: $ => choice(
      seq('@', field('name', alias(choice('len', 'repr'), $.builtin_name)), '(', $.expression, ')'),
      seq('@', field('name', alias(choice('sizeof', 'alignof'), $.builtin_name)), '(', choice($.type, $.expression), ')'),
      seq('@', field('name', alias('offsetof', $.builtin_name)), '(', $.type, ',', $.identifier, ')'),
      seq('@', field('name', alias('embed', $.builtin_name)), '(', $.string_literal, ')'),
    ),

    inline_assembly_expression: $ => seq(
      '@', alias('asm', $.builtin_name),
      '(',
      field('template', $.string_literal),
      repeat(seq(',', $.assembly_operand)),
      optional(','),
      ')',
    ),

    assembly_operand: $ => choice(
      seq(alias('out', $.assembly_keyword), field('type', $.type), field('constraint', $.string_literal)),
      seq(alias('in', $.assembly_keyword), field('value', $.expression), field('constraint', $.string_literal)),
      seq(alias('clobber', $.assembly_keyword), field('name', $.string_literal)),
      alias('volatile', $.assembly_keyword),
    ),

    type: $ => choice(
      $.named_type,
      $.captured_type,
      $.pointer_type,
      $.dynamic_trait_type,
      $.slice_type,
      $.array_type,
      $.function_type,
      $.struct_type,
      $.enum_type,
      $.flags_type,
      $.union_type,
      $.trait_type,
      $.opaque_type,
      $.representation_type,
      $.when_type,
    ),

    named_type: $ => seq($.type_path, optional($.type_arguments)),
    captured_type: $ => seq(
      '$', field('name', $.type_identifier),
      optional(seq(':', field('constraint', $.type))),
    ),
    type_path: $ => prec.left(seq($.type_identifier, repeat(seq('.', $.type_identifier)))),
    type_arguments: $ => seq('(', commaSep1($.type), optional(','), ')'),

    when_type: $ => prec.right(seq(
      'when', field('condition', $.expression), field('consequence', $.when_type_block),
      repeat(seq('else', 'when', field('condition', $.expression), field('consequence', $.when_type_block))),
      optional(seq('else', field('alternative', $.when_type_block))),
    )),

    when_type_block: $ => seq('{', field('value', choice($.type, $.compiler_error_directive)), '}'),

    pointer_type: $ => seq('*', optional('mut'), $.type),
    dynamic_trait_type: $ => seq('*', optional('mut'), 'dyn', $.named_type),
    slice_type: $ => seq('[', ']', optional('mut'), $.type),
    array_type: $ => seq('[', field('length', $.expression), ']', field('element', $.type)),
    function_type: $ => seq(
      '*',
      '(',
      optional(seq(commaSep1(seq(optional('...'), $.type)), optional(','))),
      ')',
      ':',
      field('return_type', $.type),
    ),

    struct_type: $ => seq(
      'struct',
      repeat($.attribute),
      '{',
      optional(seq(commaSep1($.struct_field), optional(','))),
      '}',
    ),

    struct_field: $ => choice(
      seq(field('name', $.identifier), ':', field('type', $.type)),
      $.union_type,
    ),

    enum_type: $ => seq(
      'enum', '{', optional(seq(commaSep1($.enum_member), optional(','))), '}',
    ),
    enum_member: $ => seq(field('name', $.identifier), optional(seq('=', field('value', $.integer_literal)))),

    flags_type: $ => seq(
      alias('flags', $.type_keyword),
      '(', field('underlying', $.named_type), ')',
      '{', optional(seq(commaSep1($.flags_member), optional(','))), '}',
    ),
    flags_member: $ => seq(field('name', $.identifier), optional(seq('=', field('value', $.expression)))),

    union_type: $ => seq(
      'union',
      optional(seq('(', field('tag', choice($.type, $.auto_attribute)), ')')),
      '{', optional(seq(commaSep1(choice($.union_field, $.union_variant)), optional(','))), '}',
    ),
    auto_attribute: $ => seq('@', alias('auto', $.attribute_name)),
    union_field: $ => seq(field('name', $.identifier), ':', field('type', $.type)),
    union_variant: $ => seq(
      field('name', $.identifier),
      optional(seq('(', optional(seq(commaSep1($.payload_field), optional(','))), ')')),
    ),
    payload_field: $ => choice(
      $.type,
      seq(field('name', $.identifier), ':', field('type', $.type)),
    ),

    trait_type: $ => seq(
      'trait', '{', repeat(seq($.trait_method, optional(choice(',', ';')))), '}',
    ),
    trait_method: $ => seq(
      'let',
      field('name', $.identifier),
      '(',
      field('receiver', $.receiver_parameter),
      repeat(seq(',', choice($.type_parameter, $.trait_parameter))),
      optional(','),
      ')',
      optional(seq(':', field('return_type', $.return_type))),
      optional(field('body', choice($.block, seq('=', $.expression)))),
    ),
    trait_parameter: $ => seq(field('name', $.identifier), ':', field('type', $.type)),

    opaque_type: _ => 'opaque',
    representation_type: $ => seq('@', alias('reprof', $.builtin_name), '(', $.type, ')'),

    literal: $ => choice(
      $.integer_literal,
      $.float_literal,
      $.string_literal,
      $.c_string_literal,
      $.character_literal,
      $.boolean_literal,
      $.nil_literal,
    ),

    integer_literal: _ => token(choice(
      /0[bB][01]+/,
      /0[oO][0-7]+/,
      /0[xX][0-9a-fA-F]+/,
      /[0-9]+/,
    )),
    float_literal: _ => token(/[0-9]+\.[0-9]+/),
    string_literal: $ => seq('"', repeat(choice($.escape_sequence, $.string_content)), '"'),
    c_string_literal: $ => seq('c"', repeat(choice($.escape_sequence, $.string_content)), '"'),
    character_literal: $ => seq("'", choice($.escape_sequence, /[^'\\\n]/), "'"),
    string_content: _ => token.immediate(prec(1, /[^"\\\n]+/)),
    escape_sequence: _ => token.immediate(/\\[\\"'nrtbfva0]/),
    boolean_literal: _ => choice('true', 'false'),
    nil_literal: _ => 'nil',
    no_initializer: _ => '---',

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
    type_identifier: $ => alias($.identifier, $.type_identifier),
    attribute_name: $ => alias($.identifier, $.attribute_name),

    line_comment: _ => token(seq('//', /[^\n]*/)),
    block_comment: _ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

function binary($, precedence, operator) {
  return prec.left(precedence, seq(
    field('left', $.expression),
    field('operator', operator),
    field('right', $.expression),
  ));
}
