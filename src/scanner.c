#include <tree_sitter/parser.h>

//#define DEBUG

enum TokenType {
  COMMENT_BLOCK_CLASSIC_CONTENT,
  COMMENT_BLOCK_ROUND_CONTENT,
  CURLY_BRACKETS_CONTENT,
  STRING_DOUBLE_CONTENT,
  STRING_SINGLE_CONTENT,
  ERROR_SENTINEL,
};

static void advance(TSLexer *lexer) {lexer->advance(lexer, false);}
static void mark(TSLexer *lexer) {lexer->mark_end(lexer);}


static const char comment_block_closing_symbol[] = {
    [COMMENT_BLOCK_CLASSIC_CONTENT] = '/',
    [COMMENT_BLOCK_ROUND_CONTENT] = ')',
    [CURLY_BRACKETS_CONTENT] = '}',
    [STRING_DOUBLE_CONTENT]='\"',
    [STRING_SINGLE_CONTENT]='\'',
};
// comment block IDs
static const unsigned comment_block_types[] = {
    COMMENT_BLOCK_CLASSIC_CONTENT,
    COMMENT_BLOCK_ROUND_CONTENT,
};
static const unsigned comment_block_types_len = sizeof(comment_block_types) / sizeof(unsigned);

// curly and string IDs
static const unsigned single_term_types[] = {
    CURLY_BRACKETS_CONTENT,
    STRING_DOUBLE_CONTENT,
    STRING_SINGLE_CONTENT,
};
static const unsigned single_term_types_len = sizeof(single_term_types) / sizeof(unsigned);

#ifdef DEBUG
#define DEBUG(code) code
static const char* const names[] = {
    [COMMENT_BLOCK_CLASSIC_CONTENT] = "COMMENT_BLOCK_CLASSIC_CONTENT",
    [COMMENT_BLOCK_ROUND_CONTENT] = "COMMENT_BLOCK_ROUND_CONTENT",
    [CURLY_BRACKETS_CONTENT] = "CURLY_BRACKETS_CONTENT",
    [STRING_DOUBLE_CONTENT] = "STRING_DOUBLE_CONTENT",
    [STRING_SINGLE_CONTENT] = "STRING_SINGLE_CONTENT",
    [ERROR_SENTINEL] = "ERROR_SENTINEL",
};
static const unsigned all_enums[] = {
  COMMENT_BLOCK_CLASSIC_CONTENT,
  COMMENT_BLOCK_ROUND_CONTENT,
  CURLY_BRACKETS_CONTENT,
  STRING_DOUBLE_CONTENT,
  STRING_SINGLE_CONTENT,
  ERROR_SENTINEL,
};
static const unsigned all_enums_len = sizeof(all_enums) / sizeof(unsigned);
static void print_names(const bool *valid_symbols){
    for (unsigned i=0;i<all_enums_len;i++) {
        unsigned enum_id = all_enums[i];
        const char* name = names[enum_id];
        printf("-- %s: %i\n", name, valid_symbols[enum_id]);
    }
};
#else
#define DEBUG(code)
#endif


void * tree_sitter_ndf_external_scanner_create() {return NULL;}
void tree_sitter_ndf_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_ndf_external_scanner_serialize(void *payload, char *buffer) {return 0;}
void tree_sitter_ndf_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

bool tree_sitter_ndf_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    DEBUG(
        printf("== STARTING EXTERNAL\n");
        print_names(valid_symbols);
    )
    
    if (valid_symbols[ERROR_SENTINEL]) { // just bail on error
        DEBUG(printf("== BAILING\n");)
        return false;
    };
    // processing comment blocks
    if (valid_symbols[COMMENT_BLOCK_CLASSIC_CONTENT] | valid_symbols[COMMENT_BLOCK_ROUND_CONTENT]) {
  DEBUG(printf("== is comment body\n");)
        mark(lexer);
        while (!lexer->eof(lexer)) {
            if (lexer->lookahead == '*') {
          DEBUG(printf("-- got *\n");)
                advance(lexer);
                while (lexer->lookahead == '*') {
                    // skip in case there are series of stars
                    DEBUG(printf("-- extra *\n");)
                    mark(lexer);
                    advance(lexer);
                    continue;
                };
                for (unsigned i=0; i<comment_block_types_len; i++) {
                    unsigned comment_type = comment_block_types[i];
                    if (!valid_symbols[comment_type]) {
                        continue;
                    };
                    char terminator = comment_block_closing_symbol[comment_type];
              DEBUG(printf("-- lookahead is '%c' vs '%c'\n", lexer->lookahead, terminator);)
                    if (lexer->lookahead == terminator) {
                  DEBUG(printf("-- is terminator\n");)
                        lexer->result_symbol = comment_type;
                        return true;
                    }
                }
            };
            advance(lexer);
      DEBUG(printf("-- mark end here\n");)
            mark(lexer);
        };
  DEBUG(printf("== got NULL\n");)
        return false;
    };
    
    // processing curly brackets content
    if (valid_symbols[CURLY_BRACKETS_CONTENT]) {
        while (!lexer->eof(lexer)) {
            switch (lexer->lookahead) {
                case '\\': // escape character
                    advance(lexer);
                    break;
                case '}':
                    lexer->result_symbol = CURLY_BRACKETS_CONTENT;
                    return true;
            };
            advance(lexer);
            mark(lexer);
        };
        return false;
    };
    
    if (valid_symbols[STRING_DOUBLE_CONTENT] | valid_symbols[STRING_SINGLE_CONTENT]) {
        bool is_valid_string = true;
        while (!lexer->eof(lexer)) {
            switch (lexer->lookahead) {
                case '\\': // escape character
                    advance(lexer);
                    break;
                case '"':
                    if (valid_symbols[STRING_DOUBLE_CONTENT]) {
                        lexer->result_symbol = STRING_DOUBLE_CONTENT;
                        return true;
                    }; break;
                case '\'':
                    if (valid_symbols[STRING_SINGLE_CONTENT]) {
                        lexer->result_symbol = STRING_SINGLE_CONTENT;
                        return true;
                    }; break;
                case '\r':
                case '\n':
                    return false;
            };
            advance(lexer);
            mark(lexer);
        };
        return false;
    };
    return false;
}
