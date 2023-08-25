
#include <cstdlib>
#include <string>
#include <cstring>
#include <cstdint>
#include "emscripten.h"
#include "emscripten/bind.h"

extern "C"
{
    std::size_t strLenC8N(const char *str, std::size_t maxLength) { return strnlen(str, maxLength); }
    std::size_t strLenC8(const char *str) { return strlen(str); }
    std::size_t strLenS16(std::u16string str) { return str.length(); }
    std::size_t strLenS8(std::string str) { return str.length(); }

    // No versions of strlen for char16_t...
    std::size_t strLenC16N(const char16_t *str, std::size_t maxLength)
    {
        abort();
        printf("What happens here?");
        std::size_t ret = 0;
        while (str[ret] && maxLength)
        {
            ++ret;
            --maxLength;
        }
        return ret;
    }
    
    std::size_t strLenC16(const char16_t *str)
    {
        printf("What happens here?");
        std::size_t ret = 0;
        while (str[ret])
            ++ret;
        return ret;
    }
}

/*
EMSCRIPTEN_BINDINGS(idk) {
    emscripten::function("strLenS8", &strLenS8, emscripten::allow_raw_pointer<const char*>{});
    emscripten::function("strLenC8", &strLenC8, emscripten::allow_raw_pointer<const char*>{});
    emscripten::function("strLenC8N", &strLenC8N, emscripten::allow_raw_pointer<const char*>{});
    emscripten::function("strLenS16", &strLenS16, emscripten::allow_raw_pointer<const char16_t*>{});
    emscripten::function("strLenC16", &strLenC16, emscripten::allow_raw_pointer<const char16_t*>{});
    emscripten::function("strLenC16N", &strLenC16N, emscripten::allow_raw_pointer<const char16_t*>{});
}
*/
/*
extern "C"
{
    __attribute__((export_name("strLenS8"))) std::size_t strLenS8(std::basic_string<char> str) { return strLen(str); }
    __attribute__((export_name("strLenS16"))) std::size_t strLenS16(std::basic_string<char16_t> str) { return strLen(str); }
    __attribute__((export_name("strLenC8"))) std::size_t strLenC8(const char *str) { return strLen(str); }
    __attribute__((export_name("strLenC16"))) std::size_t strLenC16(const char16_t *str) { return strLen(str); }
}

*/
