[
  (block)
  (compile_time_block)
  (when_expression_block)
  (when_type_block)
  (link_block)
  (struct_literal)
  (sequence_literal)
  (struct_type)
  (enum_type)
  (flags_type)
  (union_type)
  (trait_type)
  (match_expression)
  (import_declaration)
  (parameter_list)
  (argument_list)
  (type_arguments)
  (attribute)
  (return_type)
  (function_type)
  (inline_assembly_expression)
] @indent.begin

[
  ")"
  "]"
  "}"
] @indent.end

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @indent.branch

[
  (line_comment)
  (block_comment)
  (string_literal)
  (c_string_literal)
  (character_literal)
] @indent.ignore
