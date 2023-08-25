#include "test2.hpp"
#include <cstdlib>
#include <vector>
#include <iostream>

/*
#include "core/src/Reader.h"
#include "core/src/qrcode/QRReader.h"
#include "core/src/ImageView.h"
#include "core/src/ReadBarcode.h"
*/

extern "C"
{
    const void *foo()
    {
        return "strings?";
    }
}

__attribute__((export_name("bar2")))
const char16_t *bar2()
{

    std::puts("std::puts23");
    std::printf("std::puts");
    std::cout << "std::cout" << std::endl;
    std::puts("std::puts again");
    std::vector<char> v{};
    v.push_back(0);
    barExternal();
    return u"0hello world";
}
